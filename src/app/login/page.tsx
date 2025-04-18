//src/app/login/page.tsx


'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Import AuthError for typed catch block
import { signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from '@/services/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/constants/translations';
import { LanguageToggleSwitch } from '@/components/LanguageToggleSwitch';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();

  useEffect(() => {
    if (loading) return;
    if (user && user.emailVerified) {
        router.push('/chat');
    } else if (user && !user.emailVerified) {
        auth.signOut(); // Sign out unverified user if they land here
    }
  }, [user, loading, router]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    if (!email || !password) {
      setError(translations.errorFillBoth[language]);
      setIsLoggingIn(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        setError(translations.errorNotVerified[language]);
        await auth.signOut();
        // No need to return here, finally will run, state updates handle UI
      }
      // Redirect handled by useEffect if verification passes implicitly
    } catch (err) { // Use 'unknown' initially or directly use 'AuthError' if confident
       // Type guard or cast if needed, but checking 'code' often implies AuthError
       if ((err as AuthError).code) { // Check if 'code' exists, common for AuthError
            const firebaseError = err as AuthError;
            if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
                setError(translations.errorCredentials[language]);
            } else if (firebaseError.code === 'auth/invalid-email') {
                setError(translations.errorInvalidEmail[language]);
            } else if (firebaseError.code === 'auth/too-many-requests') {
                setError(translations.errorTooManyRequests[language]);
            } else {
                console.error("Login Error (Firebase):", firebaseError.code, firebaseError.message);
                setError(translations.errorLoginFailed[language]);
            }
       } else {
            // Handle non-Firebase errors or log differently
            console.error("Login Error (Unknown):", err);
            setError(translations.errorLoginFailed[language]);
       }
    } finally {
        setIsLoggingIn(false);
    }
  };

  // Wait for auth and language context
  if (loading || !language) {
      const loadingText = language ? translations.loading[language] : 'Loading...';
      // Apply centering wrapper to loading state
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            {/* Maintain original loading div structure inside the wrapper */}
            <div className="container" style={{textAlign: 'center', marginTop: '50px'}}>{loadingText}</div>
        </div>
      );
  }

   // Prevent rendering form if user is logged in (handled by useEffect redirect)
   if (user) {
        const loadingText = language ? translations.loading[language] : 'Loading...';
         // Apply centering wrapper to loading state
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                 {/* Maintain original loading div structure inside the wrapper */}
                 <div className="container" style={{textAlign: 'center', marginTop: '50px'}}>{loadingText}</div>
            </div>
        );
   }

  // --- Wrapper Div for Centering ---
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        {/* --- Original Content Div (Now Centered and Wider) --- */}
        {/* Added width: '50%' to the inline style */}
        {/* NOTE: You might want to add a max-width as well for very large screens */}
        <div
          className="container container--narrow" // Keeping original classes, width style will override/supplement
          style={{
            position: 'relative',
            paddingTop: '60px',
            width: '50%', // Set the width to 50% of the parent (the centering div)
           // Consider adding a max-width if 50% becomes too large on wide screens:
           // maxWidth: '800px' // Example max-width
          }}
        >

            {/* --- Language Toggle --- */}
            {/* Position remains relative to this div */}
            <div style={{ position: 'absolute', top: '21px', right: '15px' }}>
                 <LanguageToggleSwitch />
            </div>
            {/* --- End Language Toggle --- */}

          <h1 className="page-title">{translations.loginTitle[language]}</h1>

          <form onSubmit={handleLogin}>
             <div style={{ marginBottom: '20px' }}>
              <label htmlFor="email" className="field-label">{translations.emailLabel[language]}</label>
              <input
                type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required className="search-box"
                disabled={isLoggingIn}
                placeholder="your@email.com"
              />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label htmlFor="password" className="field-label">{translations.passwordLabel[language]}</label>
              <input
                type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required className="search-box"
                disabled={isLoggingIn}
                placeholder="********"
              />
            </div>

            {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px' }}>{error}</p>}

            <div className="button-container" style={{ marginTop: '0' }}>
              <button type="submit" className="button button-search"
                disabled={isLoggingIn}
               >
                {isLoggingIn ? translations.loggingInButton[language] : translations.loginButton[language]}
              </button>
            </div>
          </form>

          <p style={{ marginTop: '30px', textAlign: 'center' }}>
            {translations.noAccount[language]} <Link href="/signup" className="link">{translations.registerHere[language]}</Link>
          </p>
        </div>
        {/* --- End Original Content Div --- */}
    </div>
     // --- End Wrapper Div for Centering ---
  );
}