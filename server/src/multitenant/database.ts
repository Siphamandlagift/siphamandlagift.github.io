import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getOrInitFirestoreDb() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getFirestore(getApp());
}