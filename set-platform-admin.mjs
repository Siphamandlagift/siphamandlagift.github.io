import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const email = 'siphamandlagift730@gmail.com';
const snap = await db.collection('tenantUsers').where('emailLower', '==', email.toLowerCase()).limit(1).get();

if (snap.empty) {
  console.log(`No user found with email "${email}". Please register first at https://skillsconnect-f2275.web.app/tenant/register`);
  process.exit(1);
}

const doc = snap.docs[0];
await doc.ref.update({ isPlatformAdmin: true });
console.log(`✓ isPlatformAdmin set to true for ${email} (userId: ${doc.id})`);
