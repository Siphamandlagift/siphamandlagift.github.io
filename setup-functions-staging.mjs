/**
 * Creates a lean functions staging directory containing only:
 * - Compiled server code (dist/firebase/)
 * - A minimal package.json with only server-side production dependencies
 *
 * This avoids packaging the full node_modules (500+ MB) and
 * unrelated files. Firebase will run `npm install` on their build
 * servers using the staging package.json.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const stagingDir = './dist/functions-staging';

// Clean and recreate staging directory
if (existsSync(stagingDir)) {
  rmSync(stagingDir, { recursive: true });
}
mkdirSync(stagingDir, { recursive: true });

// Copy compiled server code preserving the dist/firebase path
// so that package.json "main" field stays valid
cpSync('./dist/firebase', join(stagingDir, 'dist/firebase'), { recursive: true });

// Copy functions.yaml (Firebase CLI reads it from the source directory)
if (existsSync('./functions.yaml')) {
  copyFileSync('./functions.yaml', join(stagingDir, 'functions.yaml'));
}

// Build a minimal server-only package.json
const rootPkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Packages that exist only in the browser / Angular frontend
const frontendOnly = new Set([
  'firebase',        // client SDK – server uses firebase-admin
  'jspdf',
  'pdfjs-dist',
  'rxjs',
  'tslib',
  'xlsx',
]);

const serverDeps = Object.fromEntries(
  Object.entries(rootPkg.dependencies ?? {}).filter(([name]) => {
    if (name.startsWith('@angular/') || name.startsWith('@angular-')) return false;
    if (frontendOnly.has(name)) return false;
    // type-only packages are not needed at runtime
    if (name.startsWith('@types/')) return false;
    return true;
  })
);

const stagingPkg = {
  type: 'module',
  name: 'lms-app-functions',
  version: rootPkg.version,
  main: 'dist/firebase/server/src/index.js',
  dependencies: serverDeps,
  engines: { node: '22' },
};

writeFileSync(join(stagingDir, 'package.json'), JSON.stringify(stagingPkg, null, 2));

console.log(`✓ Functions staging directory ready: ${stagingDir}`);
console.log(`  Compiled code: dist/firebase/`);
console.log(`  Server dependencies: ${Object.keys(serverDeps).join(', ')}`);
