import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

// Firebase config (typically loaded from environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase if it hasn't been initialized yet
let firebaseApp: FirebaseApp;

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    // Server-side rendering - don't initialize Firebase
    throw new Error('Firebase client should not be used server-side');
  }
  
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
  
  return firebaseApp;
} 