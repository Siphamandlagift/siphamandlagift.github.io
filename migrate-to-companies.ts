// One-time migration: copies today's single-tenant Firestore store (lmsStores/primary and its 13
// subcollections) into a new companies/{companyId} document, becoming that company's data under
// the multi-tenant retrofit. COPIES, never moves or deletes — the source document is left fully
// intact, so a bad post-migration deploy can be rolled back by reverting the code (which still
// reads lmsStores/primary) with zero data loss, rather than needing to reverse this migration
// under pressure. Safe to re-run: every write uses the source document's own id, so a re-run
// overwrites identically instead of duplicating.
//
// Requires Application Default Credentials for skillsconnect-f2275 to be available locally (e.g.
// via `gcloud auth application-default login` or GOOGLE_APPLICATION_CREDENTIALS pointing at a
// service account key) — this repo's local dev normally uses a JSON-file backend instead of real
// Firestore, so this script needs credentials that day-to-day local dev doesn't. If those aren't
// available, the same logic (server/src/migration.ts) can be run instead via the temporary
// secret-guarded HTTPS route added for that purpose — see server.ts's migration route.
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
import { getFirestore } from 'firebase-admin/firestore';
import { migrateStoreToCompany, VALID_SUBSCRIPTION_PLANS, type MigrationOptions } from './server/src/migration.js';
import type { SubscriptionPlan } from './server/src/contracts.js';

function parseArgs(argv: string[]): MigrationOptions {
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
  const licenseLimit = Number(flags.get('license-limit') ?? '');
  const startDate = (flags.get('start-date') ?? '').trim();
  const endDate = (flags.get('end-date') ?? '').trim();
  const createdBySuperAdminId = (flags.get('created-by') ?? 'migration-script').trim();
  const commit = flags.get('commit') === 'true';

  if (!VALID_SUBSCRIPTION_PLANS.includes(plan)) {
    console.error(`--plan must be one of ${VALID_SUBSCRIPTION_PLANS.join(', ')}`);
    process.exit(1);
  }

  return { companyId, name, plan, licenseLimit, startDate, endDate, createdBySuperAdminId, commit };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (getApps().length === 0) initializeApp();
  const firestore = getFirestore();

  console.log(`Mode: ${options.commit ? 'COMMIT (will write)' : 'DRY RUN (no writes)'}\n`);

  const result = await migrateStoreToCompany(firestore, options);

  console.log(`Source:      ${result.source}`);
  console.log(`Destination: ${result.destination}`);
  if (result.destinationAlreadyExisted) {
    console.warn(`WARNING: destination already existed — this run overwrote same-id docs (nothing under a different id was removed).`);
  }
  console.log('');
  for (const [collectionName, count] of Object.entries(result.perCollectionCounts)) {
    console.log(`${collectionName}: ${count} record(s)`);
  }
  console.log(`\nauthAccounts backfilled with companyId/usernameLower/emailLower: ${result.authAccountsBackfilled}`);
  console.log(`passwordResetTokens backfilled with companyId: ${result.passwordResetTokensBackfilled}`);
  console.log(`\nCompany document: ${JSON.stringify(result.companyDocPreview, null, 2)}`);
  console.log(`\nTotal write operations: ${result.totalWriteOperations}`);

  if (result.mode === 'dry-run') {
    console.log('\nDry run complete — no data was written. Re-run with --commit to apply.');
    return;
  }

  console.log('\nWrite complete. Verification:');
  let allMatch = true;
  for (const [collectionName, counts] of Object.entries(result.verification?.perCollection ?? {})) {
    const status = counts.actual === counts.expected ? 'OK' : 'MISMATCH';
    if (counts.actual !== counts.expected) allMatch = false;
    console.log(`${collectionName}: expected ${counts.expected}, got ${counts.actual} — ${status}`);
  }
  console.log(`company document: ${result.verification?.companyDocOk ? 'OK' : 'MISMATCH'}`);

  if (!allMatch || !result.verification?.companyDocOk) {
    console.error('\nVerification FAILED — review the mismatches above before proceeding.');
    process.exit(1);
  }

  console.log('\nVerification passed. Migration complete.');
  console.log(`\nSet LMS_DEFAULT_COMPANY_ID=${options.companyId} on the api Cloud Function before/with the Phase 2 code deploy.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
