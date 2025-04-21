/**
 * Firebase Configuration
 *
 * This file initializes and exports Firebase services (Authentication, Firestore)
 * using environment variables for configuration.
 * It ensures Firebase is initialized only once, compatible with SSR.
 */
// src/services/firebase/config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore"; 
// import { getStorage } from "firebase/storage";    // If you use Storage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Initialize Firebase only in the browser (client-side)
// Prevent reinitialization for hot reloads or multiple imports
// Initialize Firebase only in the browser (client-side)
// Prevent reinitialization for hot reloads or multiple imports
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
if (typeof window !== 'undefined') {
  // Client-side initialization
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // On server side, provide stubs (won't be used)
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}
// Export Firebase instances
export { app, auth, db };