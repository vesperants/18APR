// src/components/LanguageToggleSwitch.tsx
'use client';
import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './LanguageToggleSwitch.module.css';

export const LanguageToggleSwitch: React.FC = () => {
  const { language, toggleLanguage } = useLanguage();
  const isEnglish = language === 'en';

  // Optional: for inline style depending on your design
  // const buttonStyle: React.CSSProperties = { fontSize: '1.1rem', padding: 0, borderRadius: '50%', width: 38, height: 38, ... }

  return (
    <button
      className={`${styles.languageButton} ${isEnglish ? styles.nepaliOption : styles.englishOption}`.trim()}
      onClick={toggleLanguage}
      title={isEnglish ? "नेपालीमा बदल्नुहोस्" : "Switch to English"}
      aria-label={isEnglish ? "Switch to Nepali" : "Switch to English"}
      type="button"
    >
      {isEnglish ? 'ने' : 'EN'}
    </button>
  );
};