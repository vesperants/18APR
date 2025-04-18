// src/app/layout.tsx
import type { Metadata } from 'next';
import React from 'react';
import './global.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';

// 1. Import the font function from next/font/google
import { Baloo_2 } from 'next/font/google';

// 2. Configure the font
const baloo = Baloo_2({
  subsets: ['latin', 'devanagari'], // Include Devanagari for Nepali script
  weight: ['400', '500', '600', '700', '800'], // Specify the weights you use
  display: 'swap', // Use swap for better perceived performance
  variable: '--font-baloo', // Define a CSS variable name
});

export const metadata: Metadata = {
  title: 'नेपाल कानून पत्रीका अनुप्रयोग',
  description: 'नेपाल कानून पत्रीका खोज, लगइन, र अन्य सुविधाहरू।',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 3. Apply the font CSS variable to the <html> tag
    //    The variable (--font-baloo) is now available globally in CSS
    //    We also keep a generic fallback category like 'sans-serif'
    <html lang="ne" className={`${baloo.variable} font-sans`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/*
          REMOVE the <link> tags previously used for loading Baloo 2:
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400..800&display=swap"
            rel="stylesheet"
          />
         */}
      </head>
      <body> {/* Body does not need the class directly if html has the variable */}
        <AuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

// Note: The `font-sans` class added to <html> is often used with Tailwind CSS.
// If you are NOT using Tailwind, you might remove it or ensure it doesn't conflict.
// The primary mechanism here is the `baloo.variable` which makes `--font-baloo` available.