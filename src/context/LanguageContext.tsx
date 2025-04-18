// src/context/LanguageContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ne' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

// Default language
const defaultLanguage: Language = 'ne';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [isInitialized, setIsInitialized] = useState(false); // Prevent SSR/initial mismatch

  // Load language from localStorage on client-side mount
  useEffect(() => {
    const storedLanguage = localStorage.getItem('appLanguage') as Language | null;
    if (storedLanguage && (storedLanguage === 'ne' || storedLanguage === 'en')) {
      setLanguageState(storedLanguage);
    }
    setIsInitialized(true); // Mark as initialized after checking localStorage
  }, []);

  // Update localStorage when language changes
  const setLanguage = (lang: Language) => {
     if (!isInitialized) return; // Don't update localStorage until initialized
    try {
        setLanguageState(lang);
        localStorage.setItem('appLanguage', lang);
        // Optionally update html lang attribute
        document.documentElement.lang = lang;
    } catch (error) {
        console.error("Could not save language preference:", error)
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ne' ? 'en' : 'ne');
  };

  // Prevent rendering children until language is loaded from localStorage
  // This avoids hydration mismatches if server default differs from stored preference
   if (!isInitialized) {
       return null; // Or a loading indicator
   }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};