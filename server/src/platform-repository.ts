import { randomUUID } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { hashPasswordResetToken } from './auth-utils.js';
import type {
  CompanyRecord,
  CompanyUsageSummary,
  CreateCompanyInput,
  PlatformAdminRecord,
  UpdateCompanySubscriptionInput,
} from './contracts.js';

const COMPANIES_COLLECTION_ID = 'companies';
const PLATFORM_ADMINS_COLLECTION_ID = 'platformAdmins';

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

// --- Phase 3: Super Admin platform operations ---

// Create-or-update by id — used by the one-time super-admin seed (see super-admin-routes.ts's
// buildPlatformAdminRecord and seed-super-admin.ts), which is deliberately re-runnable rather than
// a strict one-shot create, so a mistyped email/password can be corrected with another run instead
// of needing a separate "delete the wrong one first" step.
export async function upsertPlatformAdmin(record: PlatformAdminRecord): Promise<void> {
  const firestore = getFirestoreClient();
  await firestore.collection(PLATFORM_ADMINS_COLLECTION_ID).doc(record.id).set(record, { merge: true });
}

export async function findPlatformAdminByEmail(email: string): Promise<PlatformAdminRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const firestore = getFirestoreClient();
  const snapshot = await firestore.collection(PLATFORM_ADMINS_COLLECTION_ID).where('emailLower', '==', normalized).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0]!.data() as PlatformAdminRecord;
}

function companyDocToRecord(id: string, data: FirebaseFirestore.DocumentData): CompanyRecord {
  return {
    id,
    name: data['name'],
    createdAt: data['createdAt'],
    createdBySuperAdminId: data['createdBySuperAdminId'],
    subscription: data['subscription'],
  } as CompanyRecord;
}

export async function listCompanies(): Promise<CompanyRecord[]> {
  const firestore = getFirestoreClient();
  const snapshot = await firestore.collection(COMPANIES_COLLECTION_ID).get();
  return snapshot.docs.map((doc) => companyDocToRecord(doc.id, doc.data()));
}

export async function getCompanyRecord(companyId: string): Promise<CompanyRecord | null> {
  if (!companyId) {
    return null;
  }

  const firestore = getFirestoreClient();
  const snapshot = await firestore.collection(COMPANIES_COLLECTION_ID).doc(companyId).get();
  if (!snapshot.exists) {
    return null;
  }

  return companyDocToRecord(snapshot.id, snapshot.data()!);
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';
}

export async function createCompanyRecord(input: CreateCompanyInput, createdBySuperAdminId: string): Promise<CompanyRecord> {
  const firestore = getFirestoreClient();
  const companyId = `${slugify(input.name)}-${randomUUID().slice(0, 8)}`;

  const record: CompanyRecord = {
    id: companyId,
    name: input.name.trim(),
    createdAt: new Date().toISOString(),
    createdBySuperAdminId,
    subscription: {
      plan: input.plan,
      licenseLimit: input.licenseLimit,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'active',
    },
  };

  // {merge: true} matches FirestoreLmsRepository's own write() convention (repository.ts) — this
  // document will also gain LmsDataStore's operational singleton fields (branding, currentKpiYear,
  // ...) the moment anything reads/writes through that company's repository for the first time, and
  // this write must not be the thing that clobbers those later (or vice versa).
  await firestore.collection(COMPANIES_COLLECTION_ID).doc(companyId).set(record, { merge: true });
  return record;
}

export async function updateCompanySubscription(companyId: string, patch: UpdateCompanySubscriptionInput): Promise<CompanyRecord | null> {
  const existing = await getCompanyRecord(companyId);
  if (!existing) {
    return null;
  }

  const nextSubscription = {
    ...existing.subscription,
    ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
    ...(patch.licenseLimit !== undefined ? { licenseLimit: patch.licenseLimit } : {}),
    ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
    ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };

  const firestore = getFirestoreClient();
  await firestore.collection(COMPANIES_COLLECTION_ID).doc(companyId).set({ subscription: nextSubscription }, { merge: true });

  return { ...existing, subscription: nextSubscription };
}

export async function getCompanyUserCount(companyId: string): Promise<number> {
  const firestore = getFirestoreClient();
  const countSnapshot = await firestore.collection(COMPANIES_COLLECTION_ID).doc(companyId).collection('authAccounts').count().get();
  return countSnapshot.data().count;
}

export async function getCompanyUsage(companyId: string): Promise<CompanyUsageSummary | null> {
  const company = await getCompanyRecord(companyId);
  if (!company) {
    return null;
  }

  const userCount = await getCompanyUserCount(companyId);
  return { userCount, licenseLimit: company.subscription.licenseLimit };
}
