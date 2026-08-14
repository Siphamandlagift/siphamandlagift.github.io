/**
 * Generates functions.yaml for Firebase deploy spec detection.
 *
 * The Firebase CLI checks for functions.yaml FIRST (detectFromYaml) before
 * attempting to spawn a subprocess and poll an HTTP endpoint. Generating
 * this file as part of the predeploy build step bypasses the HTTP detection
 * entirely, avoiding the 10-second subprocess timeout on Windows.
 */
import { spawnSync } from 'child_process';

const result = spawnSync(
  process.execPath,
  ['node_modules/firebase-functions/lib/bin/firebase-functions.js', '.'],
  {
    stdio: 'inherit',
    env: { ...process.env, FUNCTIONS_MANIFEST_OUTPUT_PATH: './functions.yaml' },
  }
);

process.exit(result.status ?? 0);
