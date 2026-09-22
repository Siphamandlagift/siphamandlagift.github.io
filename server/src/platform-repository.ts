import { randomUUID } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { hashPasswordResetToken } from './auth-utils.js';
import type {
  BrandingSettingsRecord,
  CompanyRecord,
  CompanyUsageSummary,
  CreateCompanyInput,
  PlatformAdminRecord,
  SubscriptionPlan,
  UpdateCompanySubscriptionInput,
} from './contracts.js';

const COMPANIES_COLLECTION_ID = 'companies';
const PLATFORM_ADMINS_COLLECTION_ID = 'platformAdmins';
const PLATFORM_SETTINGS_COLLECTION_ID = 'platformSettings';
const PLATFORM_BRANDING_DOC_ID = 'branding';
const defaultPlatformBranding: BrandingSettingsRecord = { themeId: 'ocean', companyLogoDataUrl: null };

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

// Resolves every company whose authAccounts contain a matching login identifier (username or
// email — this app has always accepted either at login, see AuthAccountRecord.username vs.
// .email). Email/username uniqueness is only enforced WITHIN one company at write time (see
// createAdministratorAccount/upsertManagedUserCredentials), so two different companies can
// legitimately end up with accounts sharing an identifier — most concretely, every brand-new
// company's seeded default admin used to be identical across all companies. Returning every
// candidate (instead of just the first Firestore happens to return) lets callers verify the
// actual credential/token against each one and commit only to the company where that
// verification succeeds, rather than trusting an arbitrary match.
export async function resolveCompanyIdsForLoginIdentifier(identifier: string): Promise<string[]> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const firestore = getFirestoreClient();
  const [byEmail, byUsername] = await Promise.all([
    firestore.collectionGroup('authAccounts').where('emailLower', '==', normalized).get(),
    firestore.collectionGroup('authAccounts').where('usernameLower', '==', normalized).get(),
  ]);

  const companyIds = new Set<string>();
  for (const doc of [...byEmail.docs, ...byUsername.docs]) {
    const companyId = companyIdFromSubcollectionDoc(doc.ref);
    if (companyId) {
      companyIds.add(companyId);
    }
  }

  return [...companyIds];
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

export type CompanySubscriptionContext = { active: boolean; plan: SubscriptionPlan };

// Fail-closed subscription gate applied to every authenticated, company-scoped request (see
// attachRequestContext in server.ts): a company must have status exactly 'active' AND be within
// its subscription's start/end date window, or every route for that company is rejected. Also
// returns the plan, so attachRequestContext can attach it to the request for the plan-feature
// checks in plan-features.ts, without a second Firestore read for the same document. Reads the
// companies/{companyId} document directly (bypassing FirestoreLmsRepository, which only knows
// about the LmsDataStore-shaped fields, not the company identity/subscription fields that live
// alongside them on the same document) — cheap at the "Super-Admin-managed, small number of
// companies" scale this app runs at.
export async function getCompanySubscriptionContext(companyId: string): Promise<CompanySubscriptionContext> {
  if (!companyId) {
    return { active: false, plan: 'enterprise' };
  }

  const firestore = getFirestoreClient();
  const snapshot = await firestore.collection('companies').doc(companyId).get();
  if (!snapshot.exists) {
    return { active: false, plan: 'enterprise' };
  }

  const subscription = (snapshot.data() as { subscription?: { status?: string; startDate?: string; endDate?: string; plan?: SubscriptionPlan } } | undefined)?.subscription;
  // Fails open on plan (defaults to the unrestricted tier) when the field is missing/malformed —
  // this is a display/access-shaping value, not the security boundary (that's `active` below,
  // which fails closed on anything other than exactly 'active' and currently within its window).
  const plan: SubscriptionPlan = subscription?.plan ?? 'enterprise';

  if (!subscription || subscription.status !== 'active' || !subscription.endDate || !subscription.startDate) {
    return { active: false, plan };
  }

  const now = Date.now();
  // A Super Admin can schedule a subscription to begin in the future (e.g. onboarding set up
  // ahead of the agreed start date) — the "Start date" field means nothing if access is granted
  // the moment status flips to 'active', regardless of whether that date has actually arrived yet.
  const active = now >= new Date(subscription.startDate).getTime() && now <= new Date(subscription.endDate).getTime();
  return { active, plan };
}

export async function getCompanyPlan(companyId: string): Promise<SubscriptionPlan> {
  return (await getCompanySubscriptionContext(companyId)).plan;
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
    ...(typeof data['slug'] === 'string' && data['slug'] ? { slug: data['slug'] } : {}),
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

// Public, pre-login lookup (see GET /api/companies/:slug/branding in server.ts) — the one way an
// unauthenticated visitor's browsable URL resolves to a specific company, so this must never
// return more than an exact, unambiguous match (a plain equality query already guarantees that;
// slug uniqueness itself is enforced at write time by updateCompanySlug below).
export async function getCompanyRecordBySlug(slug: string): Promise<CompanyRecord | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const firestore = getFirestoreClient();
  const snapshot = await firestore.collection(COMPANIES_COLLECTION_ID).where('slug', '==', normalized).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  return companyDocToRecord(snapshot.docs[0]!.id, snapshot.docs[0]!.data());
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

export type UpdateCompanySlugResult =
  | { status: 'ok'; company: CompanyRecord }
  | { status: 'not-found' }
  | { status: 'invalid' }
  | { status: 'taken' };

// Sets/changes the slug a company's own branded login page (.../login/{slug}) is reached at —
// see getCompanyRecordBySlug's own comment for why this must stay unambiguous. Format matches
// slugify's own output (lowercase letters/digits/hyphens only) so a Super Admin can't
// accidentally create a slug the URL router or slugify's own future auto-suggestions would mangle.
export async function updateCompanySlug(companyId: string, rawSlug: string): Promise<UpdateCompanySlugResult> {
  const existing = await getCompanyRecord(companyId);
  if (!existing) {
    return { status: 'not-found' };
  }

  const slug = rawSlug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) {
    return { status: 'invalid' };
  }

  const conflict = await getCompanyRecordBySlug(slug);
  if (conflict && conflict.id !== companyId) {
    return { status: 'taken' };
  }

  const firestore = getFirestoreClient();
  await firestore.collection(COMPANIES_COLLECTION_ID).doc(companyId).set({ slug }, { merge: true });

  return { status: 'ok', company: { ...existing, slug } };
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

// The DEFAULT login screen's branding — shown at the plain /login route, and as the fallback for
// any company that hasn't been given its own slug (or whose slug in the URL doesn't resolve to
// one — see GET /api/companies/:slug/branding in server.ts). A company-aware pre-login screen
// asking the visitor to identify themselves first was tried and deliberately reverted (see the
// login-screen retrofit plan); a company reached by its own URL doesn't have that problem, since
// the company is already known from the URL itself with no visitor input needed. Lives in its own
// top-level singleton document rather than any one company's, since it isn't owned by a company
// at all — only a Super Admin (see super-admin-routes.ts's own branding routes) may change it.
export async function getPlatformBranding(): Promise<BrandingSettingsRecord> {
  const firestore = getFirestoreClient();
  const snapshot = await firestore.collection(PLATFORM_SETTINGS_COLLECTION_ID).doc(PLATFORM_BRANDING_DOC_ID).get();
  if (!snapshot.exists) {
    return defaultPlatformBranding;
  }

  const data = snapshot.data() as Partial<BrandingSettingsRecord> | undefined;
  return {
    themeId: data?.themeId ?? defaultPlatformBranding.themeId,
    companyLogoDataUrl: data?.companyLogoDataUrl ?? null,
  };
}

export async function updatePlatformBranding(input: BrandingSettingsRecord): Promise<BrandingSettingsRecord> {
  const firestore = getFirestoreClient();
  await firestore.collection(PLATFORM_SETTINGS_COLLECTION_ID).doc(PLATFORM_BRANDING_DOC_ID).set(input);
  return input;
}
