// One-time (but safely re-runnable) seed for the first SkillsConnect Super Admin account —
// platformAdmins/{id}, entirely separate from any company's authAccounts (see the multi-tenant
// retrofit plan's Q4). Re-running with the same --email updates that same account (password
// included), so a mistyped detail can be corrected with another run rather than a manual cleanup.
//
// Requires Application Default Credentials for skillsconnect-f2275 to be available locally (see
// migrate-to-companies.ts's header comment for the same caveat and the temporary-HTTPS-route
// workaround this repo used when that wasn't available).
//
// Usage:
//   npx tsx seed-super-admin.ts --email=you@example.com --name="Your Name" --password="..."

import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { buildPlatformAdminRecord } from './server/src/super-admin-routes.js';
import { upsertPlatformAdmin, findPlatformAdminByEmail } from './server/src/platform-repository.js';

function parseArgs(argv: string[]) {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) flags.set(match[1]!, match[2]!);
  }

  const email = (flags.get('email') ?? '').trim();
  const name = (flags.get('name') ?? '').trim();
  const password = flags.get('password') ?? '';

  if (!email || !name || !password) {
    console.error('Usage: npx tsx seed-super-admin.ts --email=you@example.com --name="Your Name" --password="..."');
    process.exit(1);
  }

  return { email, name, password };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (getApps().length === 0) initializeApp();

  const existing = await findPlatformAdminByEmail(args.email);
  const id = existing?.id ?? `super-admin-${randomUUID()}`;
  const record = buildPlatformAdminRecord({ id, name: args.name, email: args.email, password: args.password });

  await upsertPlatformAdmin(record);
  console.log(`${existing ? 'Updated' : 'Created'} Super Admin account: ${record.email} (id: ${record.id})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
