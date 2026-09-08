// One-time migration: copies today's single-tenant Firestore store (lmsStores/primary and its 13
// subcollections) into a new companies/{companyId} document, becoming that company's data under
// the multi-tenant retrofit. COPIES, never moves or deletes — the source document is left fully
// intact, so a bad post-migration deploy can be rolled back by reverting the code (which still
// reads lmsStores/primary) with zero data loss, rather than needing to reverse this migration
// under pressure. Safe to re-run: every write uses the source document's own id, so a re-run
// overwrites identically instead of duplicating.
//
// Usage (dry run first — this is the default, nothing is written until --commit is passed):
//   npx tsx migrate-to-companies.ts --company-id=company-1 --name="Acme Inc" \
//     --plan=enterprise --license-limit=250 --start-date=2026-01-01 --end-date=2027-01-01
//
// Then, once the dry-run output looks right:
//   npx tsx migrate-to-companies.ts --company-id=company-1 --name="Acme Inc" \
//     --plan=enterprise --license-limit=250 --start-date=2026-01-01 --end-date=2027-01-01 --commit
//
// Take an independent Firestore export backup (gcloud firestore export) before running with
// --commit against production, as a safety net beyond this script's own non-destructive design.

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { firestoreCollectionNames } from './server/src/repository.js';
import type {
  AuthAccountRecord,
  LmsDataStore,
  PasswordResetTokenRecord,
  SubscriptionPlan,
  SubscriptionStatus,
} from './server/src/contracts.js';

// Must match FirestoreLmsRepository's own companiesCollectionId (repository.ts).
const DESTINATION_COLLECTION_ID = 'companies';
const VALID_PLANS: SubscriptionPlan[] = ['starter', 'growth', 'enterprise'];

type CliArgs = {
  companyId: string;
  name: string;
  plan: SubscriptionPlan;
  licenseLimit: number;
  startDate: string;
  endDate: string;
  createdBySuperAdminId: string;
  commit: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (arg === '--commit') {
      flags.set('commit', 'true');
      continue;
    }
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) {
      flags.set(match[1]!, match[2]!);
    }
  }

  const companyId = (flags.get('company-id') ?? '').trim();
  const name = (flags.get('name') ?? '').trim();
  const plan = (flags.get('plan') ?? '').trim() as SubscriptionPlan;
  const licenseLimitRaw = flags.get('license-limit') ?? '';
  const startDate = (flags.get('start-date') ?? '').trim();
  const endDate = (flags.get('end-date') ?? '').trim();
  const createdBySuperAdminId = (flags.get('created-by') ?? 'migration-script').trim();
  const commit = flags.get('commit') === 'true';

  const errors: string[] = [];
  if (!companyId) errors.push('--company-id is required (e.g. --company-id=company-1)');
  if (!name) errors.push('--name is required (e.g. --name="Acme Inc")');
  if (!VALID_PLANS.includes(plan)) errors.push(`--plan must be one of ${VALID_PLANS.join(', ')}`);
  const licenseLimit = Number(licenseLimitRaw);
  if (!Number.isInteger(licenseLimit) || licenseLimit <= 0) errors.push('--license-limit must be a positive whole number');
  if (!startDate || Number.isNaN(new Date(startDate).getTime())) errors.push('--start-date must be a valid date (e.g. 2026-01-01)');
  if (!endDate || Number.isNaN(new Date(endDate).getTime())) errors.push('--end-date must be a valid date (e.g. 2027-01-01)');
  if (startDate && endDate && new Date(endDate).getTime() <= new Date(startDate).getTime()) errors.push('--end-date must be after --start-date');

  if (errors.length > 0) {
    console.error('Invalid arguments:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }

  return { companyId, name, plan, licenseLimit, startDate, endDate, createdBySuperAdminId, commit };
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (getApps().length === 0) initializeApp();
  const firestore = getFirestore();

  const sourceCollectionId = process.env['LMS_FIRESTORE_COLLECTION']?.trim() || 'lmsStores';
  const sourceDocumentId = process.env['LMS_FIRESTORE_DOCUMENT_ID']?.trim() || 'primary';
  const sourceDocument = firestore.collection(sourceCollectionId).doc(sourceDocumentId);
  const destinationDocument = firestore.collection(DESTINATION_COLLECTION_ID).doc(args.companyId);

  console.log(`Source:      ${sourceCollectionId}/${sourceDocumentId}`);
  console.log(`Destination: ${DESTINATION_COLLECTION_ID}/${args.companyId}`);
  console.log(`Mode:        ${args.commit ? 'COMMIT (will write)' : 'DRY RUN (no writes)'}\n`);

  const [sourceSnapshot, destinationSnapshotBefore] = await Promise.all([
    sourceDocument.get(),
    destinationDocument.get(),
  ]);

  if (!sourceSnapshot.exists) {
    console.error(`Source document ${sourceCollectionId}/${sourceDocumentId} does not exist. Nothing to migrate.`);
    process.exit(1);
  }

  if (destinationSnapshotBefore.exists) {
    console.warn(`WARNING: ${DESTINATION_COLLECTION_ID}/${args.companyId} already exists — this run will overwrite it (same-id docs are replaced, nothing already there under a different id is removed).\n`);
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

  // The company document itself: the operational LmsDataStore singleton fields, copied verbatim
  // from the source, PLUS the new identity/subscription fields this migration introduces.
  const subscription: { plan: SubscriptionPlan; licenseLimit: number; startDate: string; endDate: string; status: SubscriptionStatus } = {
    plan: args.plan,
    licenseLimit: args.licenseLimit,
    startDate: args.startDate,
    endDate: args.endDate,
    status: 'active',
  };
  const companyDocData = {
    id: args.companyId,
    name: args.name,
    createdAt: new Date().toISOString(),
    createdBySuperAdminId: args.createdBySuperAdminId,
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

  let authAccountCount = 0;
  let passwordResetTokenCount = 0;

  for (const collectionName of firestoreCollectionNames) {
    const sourceDocs = perCollectionSourceDocs[collectionName] ?? [];
    const destinationCollection = destinationDocument.collection(collectionName);

    for (const doc of sourceDocs) {
      let data: Record<string, unknown> = doc.data();

      if (collectionName === 'authAccounts') {
        const account = data as unknown as AuthAccountRecord;
        data = {
          ...account,
          companyId: args.companyId,
          usernameLower: (account.username ?? '').trim().toLowerCase(),
          emailLower: (account.email ?? '').trim().toLowerCase(),
        };
        authAccountCount += 1;
      } else if (collectionName === 'passwordResetTokens') {
        const token = data as unknown as PasswordResetTokenRecord;
        data = { ...token, companyId: args.companyId };
        passwordResetTokenCount += 1;
      }

      operations.push((batch) => {
        batch.set(destinationCollection.doc(doc.id), JSON.parse(JSON.stringify(data)));
      });
    }

    console.log(`${collectionName}: ${sourceDocs.length} record(s)`);
  }

  console.log(`\nauthAccounts will be backfilled with companyId/usernameLower/emailLower: ${authAccountCount}`);
  console.log(`passwordResetTokens will be backfilled with companyId: ${passwordResetTokenCount}`);
  console.log(`\nCompany document fields: ${JSON.stringify({ id: companyDocData.id, name: companyDocData.name, subscription: companyDocData.subscription }, null, 2)}`);
  console.log(`\nTotal write operations: ${operations.length}`);

  if (!args.commit) {
    console.log('\nDry run complete — no data was written. Re-run with --commit to apply.');
    return;
  }

  console.log('\nCommitting...');
  await commitInChunks(firestore, operations);
  console.log('Write complete. Verifying...\n');

  let allMatch = true;
  for (const collectionName of firestoreCollectionNames) {
    const expected = (perCollectionSourceDocs[collectionName] ?? []).length;
    const actualSnapshot = await destinationDocument.collection(collectionName).get();
    const actual = actualSnapshot.size;
    const status = actual === expected ? 'OK' : 'MISMATCH';
    if (actual !== expected) allMatch = false;
    console.log(`${collectionName}: expected ${expected}, got ${actual} — ${status}`);
  }

  const destinationSnapshotAfter = await destinationDocument.get();
  const companyDocOk = destinationSnapshotAfter.exists && (destinationSnapshotAfter.data() as { name?: string })?.name === args.name;
  console.log(`company document: ${companyDocOk ? 'OK' : 'MISMATCH'}`);

  if (!allMatch || !companyDocOk) {
    console.error('\nVerification FAILED — review the mismatches above before proceeding.');
    process.exit(1);
  }

  console.log('\nVerification passed. Migration complete.');
  console.log(`\nSet LMS_DEFAULT_COMPANY_ID=${args.companyId} on the api Cloud Function before/with the Phase 2 code deploy (used by the public GET /api/branding bridge — see server.ts).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
