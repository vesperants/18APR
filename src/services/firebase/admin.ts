// src/services/firebase/admin.ts

import { initializeApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import type { App as FirebaseApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Initialize or retrieve the default Firebase Admin app
let adminApp: FirebaseApp;
if (getApps().length === 0) {
  // First-time initialization
  if (process.env.FIRE_SERVICE_ACCOUNT) {
    // Explicit service account provided as JSON string
    let serviceAccount: Record<string, any>;
    try {
      serviceAccount = JSON.parse(process.env.FIRE_SERVICE_ACCOUNT!);
      // Fix newline characters in private key if present
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    } catch (err) {
      throw new Error('Failed to parse FIRE_SERVICE_ACCOUNT JSON: ' + (err instanceof Error ? err.message : String(err)));
    }
    adminApp = initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Fallback to Application Default Credentials (e.g. Cloud Run, Cloud Functions)
    adminApp = initializeApp({ credential: applicationDefault() });
  }
} else {
  // Reuse existing app or re-initialize if missing
  try {
    adminApp = getApp();
  } catch {
    // If for some reason default app is not available, initialize again
    if (process.env.FIRE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIRE_SERVICE_ACCOUNT!);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      adminApp = initializeApp({ credential: cert(sa) });
    } else {
      adminApp = initializeApp({ credential: applicationDefault() });
    }
  }
}

// Export the Firestore database client (usable everywhere)
export const adminDb: Firestore = getFirestore(adminApp);