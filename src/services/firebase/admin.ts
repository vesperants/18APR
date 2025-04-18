// src/services/firebase/admin.ts
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp;

if (!getApps().length) {
  adminApp = initializeApp({
    credential: process.env.FIREBASE_SERVICE_ACCOUNT
      ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      : applicationDefault()
    // Optionally define the projectId from env...
  });
}

const adminDb = getFirestore();

export { adminDb };