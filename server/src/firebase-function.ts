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
    secrets: ['LMS_JWT_SECRET', 'LMS_SMTP_HOST', 'LMS_SMTP_PORT', 'LMS_SMTP_SECURE', 'LMS_SMTP_USER', 'LMS_SMTP_PASS', 'LMS_SMTP_FROM', 'LMS_ALLOW_DEMO_CREDENTIALS'],
  })
  .https.onRequest(async (req, res) => {
    const app = await getOrCreateApp();
    app(req, res);
  });