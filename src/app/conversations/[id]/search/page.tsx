import React from 'react';
import LawSearchView from '../law-search-view';

export default function LawSearchPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <LawSearchView />
    </div>
  );
}

// Make sure this is a static page that can be accessed with ?uid param
export const dynamic = 'force-static'; 