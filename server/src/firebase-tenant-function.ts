import express from 'express';
import * as functions from 'firebase-functions/v1';
import { createMultiTenantApp } from './multitenant/app.js';

let wrapperApp: express.Application | null = null;

function getOrCreateApp(): express.Application {
  if (!wrapperApp) {
    // Set default CORS origins for the Firebase-hosted environment
    // if not already configured via environment variable
    if (!process.env['MULTITENANT_CORS_ORIGIN']) {
      process.env['MULTITENANT_CORS_ORIGIN'] = [
        'https://skillsconnect-f2275.web.app',
        'https://skillsconnect-f2275.firebaseapp.com',
        'https://skillsconnect-sa.co.za',
      ].join(',');
    }
    const { app } = createMultiTenantApp();
    // Mount at /tenant-api to match the Firebase Hosting rewrite prefix
    wrapperApp = express();
    wrapperApp.use('/tenant-api', app);
  }
  return wrapperApp;
}

export const tenantApi = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['MULTITENANT_JWT_SECRET'],
  })
  .https.onRequest((req, res) => {
    getOrCreateApp()(req, res);
  });
