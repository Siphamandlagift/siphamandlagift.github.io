import * as functions from 'firebase-functions/v1';
import type { Application } from 'express';

// Lazy-load server.ts so that top-level initialization (Firestore, repository,
// email service) does NOT run during Firebase CLI backend spec detection.
// Only the first real HTTP request triggers the import.
let lmsApp: Application | null = null;

async function getOrCreateApp(): Promise<Application> {
  if (!lmsApp) {
    const { app } = await import('./server.js');
    lmsApp = app;
  }
  return lmsApp;
}

export const api = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    // LMS_DEFAULT_COMPANY_ID isn't actually secret, but rides along in Secret Manager too since
    // it's a guaranteed-to-work delivery mechanism this function already uses, rather than
    // depending on this repo's unconfirmed plain-env-var bundling path for a new var. Used only
    // by the public GET /api/branding bridge (see server.ts) until the real per-company-aware
    // pre-login experience from the retrofit plan's Phase 4 exists.
    secrets: ['LMS_JWT_SECRET', 'LMS_SMTP_HOST', 'LMS_SMTP_PORT', 'LMS_SMTP_SECURE', 'LMS_SMTP_USER', 'LMS_SMTP_PASS', 'LMS_SMTP_FROM', 'LMS_ALLOW_DEMO_CREDENTIALS', 'LMS_DEFAULT_COMPANY_ID'],
  })
  .https.onRequest(async (req, res) => {
    const app = await getOrCreateApp();
    app(req, res);
  });