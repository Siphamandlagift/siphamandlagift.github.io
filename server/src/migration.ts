// Core logic for the one-time lmsStores/primary -> companies/{companyId} migration. Shared by
// two callers: the standalone local script (migrate-to-companies.ts at the repo root, for anyone
// who has Application Default Credentials set up locally) and a temporary, secret-guarded HTTPS
// route in server.ts (used when local ADC isn't available — the Cloud Function's own runtime
// already has working credentials, so no separate local credential setup is needed there). See
// migrate-to-companies.ts's header comment for the full safety rationale: this always COPIES,
// never moves, is idempotent, and verifies itself after writing.
import type { Firestore } from 'firebase-admin/firestore';
import { firestoreCollectionNames } from './repository.js';
import type {
  AuthAccountRecord,
  LmsDataStore,
  PasswordResetTokenRecord,
  SubscriptionPlan,
  SubscriptionStatus,
} from './contracts.js';

const DESTINATION_COLLECTION_ID = 'companies';
export const VALID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = ['starter', 'growth', 'enterprise'];

export type MigrationOptions = {
  companyId: string;
  name: string;
  plan: SubscriptionPlan;
  licenseLimit: number;
  startDate: string;
  endDate: string;
  createdBySuperAdminId: string;
  commit: boolean;
  sourceCollectionId?: string;
  sourceDocumentId?: string;
};

export type MigrationResult = {
  mode: 'dry-run' | 'commit';
  source: string;
  destination: string;
  destinationAlreadyExisted: boolean;
  perCollectionCounts: Record<string, number>;
  authAccountsBackfilled: number;
  passwordResetTokensBackfilled: number;
  companyDocPreview: { id: string; name: string; subscription: unknown };
  totalWriteOperations: number;
  verification?: { allMatch: boolean; perCollection: Record<string, { expected: number; actual: number }>; companyDocOk: boolean };
};

export function validateMigrationOptions(options: Partial<MigrationOptions>): string[] {
  const errors: string[] = [];
  if (!options.companyId?.trim()) errors.push('companyId is required');
  if (!options.name?.trim()) errors.push('name is required');
  if (!options.plan || !VALID_SUBSCRIPTION_PLANS.includes(options.plan)) errors.push(`plan must be one of ${VALID_SUBSCRIPTION_PLANS.join(', ')}`);
  if (!Number.isInteger(options.licenseLimit) || (options.licenseLimit ?? 0) <= 0) errors.push('licenseLimit must be a positive whole number');
  if (!options.startDate || Number.isNaN(new Date(options.startDate).getTime())) errors.push('startDate must be a valid date');
  if (!options.endDate || Number.isNaN(new Date(options.endDate).getTime())) errors.push('endDate must be a valid date');
  if (options.startDate && options.endDate && new Date(options.endDate).getTime() <= new Date(options.startDate).getTime()) {
    errors.push('endDate must be after startDate');
  }
  return errors;
}

async function commitInChunks(firestore: Firestore, operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>) {
  for (let index = 0; index < operations.length; index += 450) {
    const batch = firestore.batch();
    for (const operation of operations.slice(index, index + 450)) {
      operation(batch);
    }
    await batch.commit();
  }
}

export async function migrateStoreToCompany(firestore: Firestore, options: MigrationOptions): Promise<MigrationResult> {
  const errors = validateMigrationOptions(options);
  if (errors.length > 0) {
    throw new Error(`Invalid migration options: ${errors.join('; ')}`);
  }

  const sourceCollectionId = options.sourceCollectionId ?? 'lmsStores';
  const sourceDocumentId = options.sourceDocumentId ?? 'primary';
  const sourceDocument = firestore.collection(sourceCollectionId).doc(sourceDocumentId);
  const destinationDocument = firestore.collection(DESTINATION_COLLECTION_ID).doc(options.companyId);

  const [sourceSnapshot, destinationSnapshotBefore] = await Promise.all([
    sourceDocument.get(),
    destinationDocument.get(),
  ]);

  if (!sourceSnapshot.exists) {
    throw new Error(`Source document ${sourceCollectionId}/${sourceDocumentId} does not exist. Nothing to migrate.`);
  }

  const sourceRootData = sourceSnapshot.data() as Partial<LmsDataStore>;

  const perCollectionSourceDocs: Record<string, FirebaseFirestore.QueryDocumentSnapshot[]> = {};
  await Promise.all(
    firestoreCollectionNames.map(async (collectionName) => {
      const snapshot = await sourceDocument.collection(collectionName).get();
      perCollectionSourceDocs[collectionName] = snapshot.docs;
    }),
  );

  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

  const subscription: { plan: SubscriptionPlan; licenseLimit: number; startDate: string; endDate: string; status: SubscriptionStatus } = {
    plan: options.plan,
    licenseLimit: options.licenseLimit,
    startDate: options.startDate,
    endDate: options.endDate,
    status: 'active',
  };
  const companyDocData = {
    id: options.companyId,
    name: options.name,
    createdAt: new Date().toISOString(),
    createdBySuperAdminId: options.createdBySuperAdminId,
    subscription,
    branding: sourceRootData.branding ?? null,
    updatedAt: sourceRootData.updatedAt ?? null,
    currentKpiYear: sourceRootData.currentKpiYear ?? null,
    kpiYearsOpened: sourceRootData.kpiYearsOpened ?? null,
    currentIdpYear: sourceRootData.currentIdpYear ?? null,
    idpYearsOpened: sourceRootData.idpYearsOpened ?? null,
    hrIntegration: sourceRootData.hrIntegration ?? null,
    approvalWorkflowSettings: sourceRootData.approvalWorkflowSettings ?? null,
  };
  operations.push((batch) => {
    batch.set(destinationDocument, JSON.parse(JSON.stringify(companyDocData)), { merge: true });
  });

  let authAccountsBackfilled = 0;
  let passwordResetTokensBackfilled = 0;
  const perCollectionCounts: Record<string, number> = {};

  for (const collectionName of firestoreCollectionNames) {
    const sourceDocs = perCollectionSourceDocs[collectionName] ?? [];
    perCollectionCounts[collectionName] = sourceDocs.length;
    const destinationCollection = destinationDocument.collection(collectionName);

    for (const doc of sourceDocs) {
      let data: Record<string, unknown> = doc.data();

      if (collectionName === 'authAccounts') {
        const account = data as unknown as AuthAccountRecord;
        data = {
          ...account,
          companyId: options.companyId,
          usernameLower: (account.username ?? '').trim().toLowerCase(),
          emailLower: (account.email ?? '').trim().toLowerCase(),
        };
        authAccountsBackfilled += 1;
      } else if (collectionName === 'passwordResetTokens') {
        const token = data as unknown as PasswordResetTokenRecord;
        data = { ...token, companyId: options.companyId };
        passwordResetTokensBackfilled += 1;
      }

      operations.push((batch) => {
        batch.set(destinationCollection.doc(doc.id), JSON.parse(JSON.stringify(data)));
      });
    }
  }

  const result: MigrationResult = {
    mode: options.commit ? 'commit' : 'dry-run',
    source: `${sourceCollectionId}/${sourceDocumentId}`,
    destination: `${DESTINATION_COLLECTION_ID}/${options.companyId}`,
    destinationAlreadyExisted: destinationSnapshotBefore.exists,
    perCollectionCounts,
    authAccountsBackfilled,
    passwordResetTokensBackfilled,
    companyDocPreview: { id: companyDocData.id, name: companyDocData.name, subscription: companyDocData.subscription },
    totalWriteOperations: operations.length,
  };

  if (!options.commit) {
    return result;
  }

  await commitInChunks(firestore, operations);

  const perCollection: Record<string, { expected: number; actual: number }> = {};
  let allMatch = true;
  for (const collectionName of firestoreCollectionNames) {
    const expected = perCollectionCounts[collectionName] ?? 0;
    const actualSnapshot = await destinationDocument.collection(collectionName).get();
    const actual = actualSnapshot.size;
    perCollection[collectionName] = { expected, actual };
    if (actual !== expected) allMatch = false;
  }

  const destinationSnapshotAfter = await destinationDocument.get();
  const companyDocOk = destinationSnapshotAfter.exists && (destinationSnapshotAfter.data() as { name?: string })?.name === options.name;

  result.verification = { allMatch, perCollection, companyDocOk };
  return result;
}
