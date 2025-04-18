// src/app/chat/error.tsx
'use client';
import { useEffect } from 'react';
interface ErrorProps {
  error: Error;
  reset: () => void;
}
export default function ChatError({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (error.message.includes('Loading chunk')) {
      // Retry loading the chunk by resetting the boundary
      reset();
    }
  }, [error, reset]);
  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <p>Oops, something went wrong loading the chat. Retrying...</p>
    </div>
  );
}