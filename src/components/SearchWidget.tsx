// src/components/SearchWidget.tsx
"use client";
import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import chatStyles from '@/app/chat/chat.module.css';
import inputStyles from './ChatInputArea.module.css';

interface SearchWidgetProps {
  configId: string;
  triggerId: string;
}

// Alias custom element to satisfy TypeScript
const GenSearchWidget: any = 'gen-search-widget';
const SearchWidget: React.FC<SearchWidgetProps> = ({ configId, triggerId }) => {
  return (
    <>
      {/* Load the widget script */}
      <Script
        src="https://cloud.google.com/ai/gen-app-builder/client?hl=en_US"
        strategy="afterInteractive"
        onError={(e) => console.error('Error loading search widget script:', e)}
      />
      {/* Invisible trigger element */}
      <button
        id={triggerId}
        type="button"
        style={{ display: 'none' }}
      />
      {/* Search widget component (overlay) */}
      <GenSearchWidget configId={configId} triggerId={triggerId}></GenSearchWidget>
    </>
  );
};

export default SearchWidget;