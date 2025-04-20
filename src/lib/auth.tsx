import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getAuth,
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { getFirebaseApp } from '@/services/firebase/client';

// Initialize Firebase app and auth
const app = getFirebaseApp();
const auth = getAuth(app);

// Define user type with specific fields we need
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Define AuthContext value type
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

// Create the AuthContext
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  error: null
});

// Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Set up auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser: FirebaseUser | null) => {
        setLoading(true);
        if (firebaseUser) {
          // Map Firebase user to our simpler User type
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (error: Error) => {
        console.error('Auth state change error:', error);
        setError(error);
        setLoading(false);
      }
    );

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  // Provide auth context to children
  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for using auth context
export function useAuth() {
  return useContext(AuthContext);
}

// Helper function to get current user ID
export function getCurrentUserId(): string | null {
  const currentUser = auth.currentUser;
  return currentUser ? currentUser.uid : null;
} 