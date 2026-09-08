import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { hashPasswordResetToken } from './auth-utils.js';

// Company-agnostic Firestore operations — things that have to run BEFORE any companyId is known,
// so they can't go through FirestoreLmsRepository (which always operates inside one already-known
// company's document tree). Today that's exactly the handful of auth entry points that receive
// only a login identifier or a password-reset token, nothing that names a company directly:
// login, resolve-roles, SSO callback, and password-reset request/validate/confirm.
function getFirestoreClient(): Firestore {
  const app = getApps().length > 0 ? getApp() : initializeApp();
  return getFirestore(app);
}

// A collection-group query matches documents named `authAccounts` under ANY company, so the
// company a match belongs to has to be read back off the document's own location — the parent of
// an `authAccounts` subcollection is always the `companies/{companyId}` document.
function companyIdFromSubcollectionDoc(ref: DocumentReference): string | null {
  return ref.parent.parent?.id ?? null;
}

// Resolves which company a login identifier belongs to. The identifier may be a username or an
// email (this app has always accepted either at login — see AuthAccountRecord.username vs.
// .email), so this tries emailLower first, then falls back to usernameLower.
export async function resolveCompanyIdForLoginIdentifier(identifier: string): Promise<string | null> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const firestore = getFirestoreClient();

  const byEmail = await firestore.collectionGroup('authAccounts').where('emailLower', '==', normalized).limit(1).get();
  if (!byEmail.empty) {
    return companyIdFromSubcollectionDoc(byEmail.docs[0]!.ref);
  }

  const byUsername = await firestore.collectionGroup('authAccounts').where('usernameLower', '==', normalized).limit(1).get();
  if (!byUsername.empty) {
    return companyIdFromSubcollectionDoc(byUsername.docs[0]!.ref);
  }

  return null;
}

// Resolves which company a password-reset token belongs to, by hashing it the same way
// createPasswordResetRequest/resetPassword do and matching against the stored tokenHash.
export async function resolveCompanyIdForPasswordResetToken(token: string): Promise<string | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashPasswordResetToken(token);
  const firestore = getFirestoreClient();
  const snapshot = await firestore.collectionGroup('passwordResetTokens').where('tokenHash', '==', tokenHash).limit(1).get();

  if (snapshot.empty) {
    return null;
  }

  return companyIdFromSubcollectionDoc(snapshot.docs[0]!.ref);
}

// Fail-closed subscription gate applied to every authenticated, company-scoped request (see
// attachRequestContext in server.ts): a company must have status exactly 'active' AND not be
// past its subscription end date, or every route for that company is rejected. Reads the
// companies/{companyId} document directly (bypassing FirestoreLmsRepository, which only knows
// about the LmsDataStore-shaped fields, not the company identity/subscription fields that live
// alongside them on the same document) — cheap at the "Super-Admin-managed, small number of
// companies" scale this app runs at.
export async function isCompanySubscriptionActive(companyId: string): Promise<boolean> {
  if (!companyId) {
    return false;
  }

  const firestore = getFirestoreClient();
  const snapshot = await firestore.collection('companies').doc(companyId).get();
  if (!snapshot.exists) {
    return false;
  }

  const subscription = (snapshot.data() as { subscription?: { status?: string; endDate?: string } } | undefined)?.subscription;
  if (!subscription || subscription.status !== 'active' || !subscription.endDate) {
    return false;
  }

  return new Date(subscription.endDate).getTime() >= Date.now();
}
