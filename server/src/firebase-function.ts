import * as functions from 'firebase-functions/v1';
import { app } from './server.js';

export const api = functions.runWith({ timeoutSeconds: 120, memory: '1GB' }).https.onRequest(app);