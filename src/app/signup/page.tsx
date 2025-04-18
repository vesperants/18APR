//src/app/signup/page.tsx


'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, AuthError } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase/config';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const saveUserProfile = async (userId: string, profileData: object) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        ...profileData,
        uid: userId,
        createdAt: serverTimestamp(),
      });
      console.log('User profile saved to Firestore');
    } catch (err) {
      console.error('Error saving user profile to Firestore:', err);
      setError('प्रोफाइल सुरक्षित गर्न असफल भयो, तर खाता सिर्जना भयो।');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setRegistrationSuccess(false);

    if (!email || !password || !confirmPassword || !name) {
      setError('कृपया इमेल, पासवर्ड, र नाम भर्नुहोस्।');
      return;
    }
    if (password !== confirmPassword) {
      setError('पासवर्डहरू मेल खाँदैनन्।');
      return;
    }
    if (password.length < 6) {
      setError('पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ।');
      return;
    }

    setIsRegistering(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User created in Auth:', user.uid);

      const profileData = {
        email: user.email,
        name: name,
        companyName: companyName,
        address: address,
        phoneNumber: phoneNumber,
      };

      await saveUserProfile(user.uid, profileData);

      await updateProfile(user, {
        displayName: name,
      });

      await sendEmailVerification(user, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      console.log('Verification email sent.');

      setRegistrationSuccess(true);

    } catch (err) {
      if ((err as AuthError).code) {
        const firebaseError = err as AuthError;
        console.error('Registration Error (Firebase):', firebaseError.code, firebaseError.message);
        if (firebaseError.code === 'auth/email-already-in-use') {
          setError('यो इमेल पहिले नै दर्ता गरिएको छ।');
        } else if (firebaseError.code === 'auth/weak-password') {
          setError('पासवर्ड कमजोर छ। कृपया बलियो पासवर्ड प्रयोग गर्नुहोस्।');
        } else if (firebaseError.code === 'auth/invalid-email') {
          setError('अमान्य इमेल ढाँचा।');
        } else {
          setError('दर्ता असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।');
        }
      } else {
        console.error('Registration Error (Unknown):', err);
        setError('दर्ता असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="container container--narrow">
      <h1 className="page-title">नयाँ खाता दर्ता गर्नुहोस्</h1>

      {registrationSuccess ? (
        <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '4px' }}>
          <h2 style={{ color: '#2e7d32' }}>दर्ता सफल भयो!</h2>
          <p>तपाईंको खाता सिर्जना गरिएको छ। कृपया आफ्नो इमेल जाँच गर्नुहोस् र प्रमाणिकरण लिङ्कमा क्लिक गर्नुहोस्।</p>
          <p style={{ marginTop: '15px' }}>
            <Link href="/login" className="button">लगइन पृष्ठमा जानुहोस्</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="name" className="field-label">पूरा नाम: <span style={{color: 'red'}}>*</span></label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="search-box" disabled={isRegistering} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="email" className="field-label">इमेल: <span style={{color: 'red'}}>*</span></label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="search-box" disabled={isRegistering} placeholder="your@email.com" />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="password" className="field-label">पासवर्ड: <span style={{color: 'red'}}>*</span></label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="search-box" disabled={isRegistering} placeholder=" कम्तिमा ६ अक्षर" />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label htmlFor="confirmPassword" className="field-label">पासवर्ड पुष्टि गर्नुहोस्: <span style={{color: 'red'}}>*</span></label>
            <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="search-box" disabled={isRegistering} placeholder="पुन: पासवर्ड टाइप गर्नुहोस्" />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="companyName" className="field-label">कम्पनीको नाम (वैकल्पिक):</label>
            <input type="text" id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="search-box" disabled={isRegistering} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="address" className="field-label">ठेगाना (वैकल्पिक):</label>
            <input type="text" id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="search-box" disabled={isRegistering} />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label htmlFor="phoneNumber" className="field-label">फोन नम्बर (वैकल्पिक):</label>
            <input type="tel" id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="search-box" disabled={isRegistering} />
          </div>

          {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px' }}>{error}</p>}

          <div className="button-container" style={{ marginTop: '0' }}>
            <button type="submit" className="button button-search" disabled={isRegistering}>
              {isRegistering ? 'दर्ता हुँदैछ...' : 'दर्ता गर्नुहोस्'}
            </button>
          </div>
        </form>
      )}

      {!registrationSuccess && (
        <p style={{ marginTop: '30px', textAlign: 'center' }}>
          पहिले नै खाता छ? <Link href="/login">यहाँ लगइन गर्नुहोस्</Link>
        </p>
      )}
    </div>
  );
}