// src/components/SignOutConfirmModal.tsx
'use client';
import React, { useEffect, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/constants/translations';

interface SignOutConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SignOutConfirmModal({
  open,
  onClose,
  onConfirm,
}: SignOutConfirmModalProps) {
  const { language } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ESC closes modal
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Click outside closes modal
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

  if (!open) return null;

  return (
    <div className="profile-modal-backdrop" aria-modal="true" tabIndex={-1}>
      <div className="profile-modal-squircle" ref={modalRef}>
        <div className="profile-modal-scroll" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
          <h2 className="page-title" style={{ fontWeight: 700, margin: '0 0 22px 0', fontSize: '1.15em' }}>
            {translations.signOutConfirmTitle?.[language] || "Sign Out"}
          </h2>
          <p style={{ marginBottom: 36 }}>
            {translations.signOutConfirmBody?.[language] || "Are you sure you want to sign out?"}
          </p>
          <div className="button-container" style={{ gap: 10, display: 'flex', justifyContent: 'center' }}>
            <button onClick={onConfirm} className="button button-search" style={{ minWidth: 90 }}>
              {translations.yesLabel?.[language] || "Yes"}
            </button>
            <button onClick={onClose} className="button" style={{ minWidth: 90, background: "#F3F3F7", color: "#333" }}>
              {translations.noLabel?.[language] || "No"}
            </button>
          </div>
        </div>
        <style jsx global>{`
         .profile-modal-backdrop {
           position: fixed; inset: 0; background: rgba(31, 31, 40, 0.50);
           z-index: 99999; display: flex; align-items: center; justify-content: center;
           backdrop-filter: blur(5.5px);
           animation: fadeUp .22s;
         }
         .profile-modal-squircle {
           position: relative;
           background: rgba(255,255,255,0.82);
           border-radius: 36px;
           box-shadow: 0 18px 60px 0 rgba(12, 18, 44, 0.25);
           min-width: 340px; max-width: 400px; width: 96vw;
           margin: 15px;
           overflow: hidden;
           padding: 0;
           max-height: 88vh;
           animation: scaleUp .21s;
         }
         .profile-modal-scroll {
           border-radius: 36px;
           overflow-y: auto;
           padding: 32px 32px 20px 32px;
         }
         @keyframes fadeUp { from { opacity: 0; } to { opacity: 1; } }
         @keyframes scaleUp { from { transform: scale(0.96); opacity:0; } to { transform: scale(1); opacity:1; } }
       `}</style>
      </div>
    </div>
  );
}