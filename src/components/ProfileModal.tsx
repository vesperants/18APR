// src/components/ProfileModal.tsx
'use client';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/constants/translations';
import { db } from '@/services/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, AuthError } from 'firebase/auth';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();

  // Form state
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on click outside or ESC
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  // Profile fetch/update
  useEffect(() => {
    if (!open || !user || !user.emailVerified || !language) return;
    const fetchProfile = async () => {
      setIsFetchingProfile(true);
      setProfileError(null);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          setCompanyName(data.companyName || '');
          setAddress(data.address || '');
          setPhoneNumber(data.phoneNumber || '');
        } else {
          setProfileError(translations.profileNotFoundError[language]);
        }
      } catch (error) {
        setProfileError(translations.profileFetchError[language]);
      } finally {
        setIsFetchingProfile(false);
      }
    };
    fetchProfile();
  }, [user, open, language]);

  const handleProfileUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!user) return;
    setProfileError(null); setProfileSuccess(null); setIsUpdatingProfile(true);
    if (!name) { setProfileError(translations.fillNameError[language]); setIsUpdatingProfile(false); return; }
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name, companyName, address, phoneNumber, updatedAt: serverTimestamp(),
      });
      setProfileSuccess(translations.profileUpdateSuccess[language]);
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (_error) {
      setProfileError(translations.profileUpdateError[language]);
    } finally { setIsUpdatingProfile(false); }
  };

  const handlePasswordChange = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!user || !user.email) return;
    setPasswordError(null); setPasswordSuccess(null);
    if (!currentPassword || !newPassword || !confirmNewPassword) { setPasswordError(translations.passwordFillAllError[language]); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError(translations.passwordMismatchError[language]); return; }
    if (newPassword.length < 6) { setPasswordError(translations.passwordLengthError[language]); return; }
    setIsChangingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setPasswordSuccess(translations.passwordChangeSuccess[language]);
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (error) {
      const firebaseError = error as AuthError;
      if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential')
        setPasswordError(translations.passwordWrongError[language]);
      else if (firebaseError.code === 'auth/weak-password')
        setPasswordError(translations.passwordWeakError[language]);
      else
        setPasswordError(translations.passwordChangeError[language]);
    } finally { setIsChangingPassword(false); }
  };

  if (!open) return null;

  // LOADING/empty states
  if (!user) {
    return (
      <div className="profile-modal-backdrop">
        <div className="profile-modal-squircle" ref={modalRef}>
          <div style={{ textAlign: 'center', padding: '50px 0' }}>{translations.loginRequired[language]}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="profile-modal-backdrop" aria-modal="true" tabIndex={-1}>
      <div className="profile-modal-squircle" ref={modalRef}>
        <div className="profile-modal-scroll">
          <h1 className="page-title">{translations.profileTitle[language]}</h1>
          {/* Profile Update Form */}
          <section style={{ marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '30px' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '1.2em' }}>{translations.personalInfo[language]}</h2>
            <form onSubmit={handleProfileUpdate}>
              {/* Name */}
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="profileName" className="field-label">{translations.fullNameLabel[language]} <span style={{ color: 'red' }}>*</span></label>
                <input type="text" id="profileName" value={name} onChange={e => setName(e.target.value)} required className="search-box" disabled={isUpdatingProfile} />
              </div>
              {/* Company */}
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="companyName" className="field-label">{translations.companyNameLabel[language]}</label>
                <input type="text" id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} className="search-box" disabled={isUpdatingProfile} />
              </div>
              {/* Address */}
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="address" className="field-label">{translations.addressLabel[language]}</label>
                <input type="text" id="address" value={address} onChange={e => setAddress(e.target.value)} className="search-box" disabled={isUpdatingProfile} />
              </div>
              {/* Phone */}
              <div style={{ marginBottom: '25px' }}>
                <label htmlFor="phoneNumber" className="field-label">{translations.phoneLabel[language]}</label>
                <input type="tel" id="phoneNumber" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="search-box" disabled={isUpdatingProfile} />
              </div>
              {profileError && <p style={{ color: 'red', marginBottom: '15px' }}>{profileError}</p>}
              {profileSuccess && <p style={{ color: 'green', marginBottom: '15px' }}>{profileSuccess}</p>}
              <div className="button-container" style={{ justifyContent: 'flex-start' }}>
                <button type="submit" className="button button-search" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? translations.savingProfileButton[language] : translations.saveProfileButton[language]}
                </button>
              </div>
            </form>
          </section>
          {/* Password Change Form */}
          <section>
            <h2 style={{ marginBottom: '20px', fontSize: '1.2em' }}>{translations.changePasswordTitle[language]}</h2>
            <form onSubmit={handlePasswordChange}>
              {/* Current Pwd */}
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="currentPassword" className="field-label">{translations.currentPasswordLabel[language]} <span style={{ color: 'red' }}>*</span></label>
                <input type="password" id="currentPassword" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="search-box" disabled={isChangingPassword} />
              </div>
              {/* New Pwd */}
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="newPassword" className="field-label">{translations.newPasswordLabel[language]} <span style={{ color: 'red' }}>*</span></label>
                <input type="password" id="newPassword" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="search-box" disabled={isChangingPassword} placeholder={translations.atLeast6Chars[language]} />
              </div>
              {/* Confirm New Pwd */}
              <div style={{ marginBottom: '25px' }}>
                <label htmlFor="confirmNewPassword" className="field-label">{translations.confirmNewPasswordLabel[language]} <span style={{ color: 'red' }}>*</span></label>
                <input type="password" id="confirmNewPassword" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="search-box" disabled={isChangingPassword} />
              </div>
              {passwordError && <p style={{ color: 'red', marginBottom: '15px' }}>{passwordError}</p>}
              {passwordSuccess && <p style={{ color: 'green', marginBottom: '15px' }}>{passwordSuccess}</p>}
              <div className="button-container" style={{ justifyContent: 'flex-start' }}>
                <button type="submit" className="button button-search" disabled={isChangingPassword}>
                  {isChangingPassword ? translations.changingPasswordButton[language] : translations.changePasswordButton[language]}
                </button>
              </div>
            </form>
          </section>
        </div>
        {/* Styles right here for speed, can move to your CSS file */}
        <style jsx global>{`
          .profile-modal-backdrop {
            position: fixed; inset: 0; background: rgba(31, 31, 40, 0.50);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(3.9px);
            animation: fadeUp .22s;
          }
          .profile-modal-squircle {
            position: relative;
            background: rgba(255, 255, 255, 0.82);
            border-radius: 36px;
            box-shadow: 0 18px 60px 0 rgba(12, 18, 44, 0.25);
            min-width: 500px; max-width: 500px; width: 99vw;
            margin: 15px;
            overflow: hidden;
            padding: 0;
            max-height: 90vh;
            animation: scaleUp .21s;
          }
          .profile-modal-scroll {
            border-radius: 36px;
            overflow-y: auto;
            max-height: 75vh;
            padding: 32px 32px 16px 32px;
            min-height: 0;
            scrollbar-color: #beb5e7 #ffffff20; /* For Firefox */
            scrollbar-width: thin;
          }
          .profile-modal-scroll::-webkit-scrollbar {
            width: 18px;
            background: transparent;
            border-radius: 13px;
          }
          .profile-modal-scroll::-webkit-scrollbar-thumb {
            border-radius: 16px;
            background: #dad3fd;
            border: 3.5px solid rgba(255,255,255,0.76);
          }
          .profile-modal-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .profile-modal-squircle input, .profile-modal-squircle label, .profile-modal-squircle button {
            font-size: 1em !important;
          }
          @keyframes fadeUp { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleUp { from { transform: scale(0.96); opacity:0; } to { transform: scale(1); opacity:1; } }
        `}</style>
      </div>
    </div>
  );
}