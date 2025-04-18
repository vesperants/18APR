//src/components/AccountMenuBubble.tsx
'use client';
import React, { useRef, useLayoutEffect, useEffect, useState } from 'react';
import { LanguageToggleSwitch } from '@/components/LanguageToggleSwitch';

interface AccountMenuBubbleProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  language: 'ne' | 'en';
  onSignOut: () => void;
  onOpenProfile: () => void;
}

export default function AccountMenuBubble({
  open,
  anchorRef,
  onClose,
  language,
  onSignOut,
  onOpenProfile
}: AccountMenuBubbleProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const [offsetStyle, setOffsetStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: -9999,
    left: -9999,
    visibility: 'hidden',
    zIndex: 99999,
  });

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, anchorRef]);

  // Center bubble under avatar once bubble is mounted
  useLayoutEffect(() => {
    if (open && anchorRef.current && menuRef.current) {
      const avatarRect = anchorRef.current.getBoundingClientRect();
      const bubbleRect = menuRef.current.getBoundingClientRect();
      const top = avatarRect.bottom + 6;
      const left =
        avatarRect.left +
        avatarRect.width / 2 -
        bubbleRect.width / 2;
      setOffsetStyle({
        position: 'fixed',
        top,
        left,
        visibility: 'visible',
        zIndex: 99999,
      });
    }
  }, [open, anchorRef]);

  if (!open) return null;
  return (
    <>
      <div ref={menuRef} style={offsetStyle} className="account-menu-bubble">
        {/* Language Toggle */}
        <div className="icon-bubble-button" title="Switch Language" style={{ padding: 0, background: 'none', boxShadow: "none" }}>
          <LanguageToggleSwitch />
        </div>
        {/* Profile */}
        <button
          className="icon-bubble-button"
          aria-label="Profile"
          title="Profile"
          tabIndex={0}
          onClick={onOpenProfile}
        >
          <img
            src="/icons/user-minimal.svg"
            alt="Profile"
            width={24}
            height={24}
            style={{ filter: 'grayscale(0.1) contrast(0.85)' }}
          />
        </button>
        {/* Sign Out */}
        <button
          className="icon-bubble-button"
          aria-label="Sign Out"
          title="Sign Out"
          tabIndex={0}
          onClick={onSignOut}
        >
          <img
            src="/icons/power-red.svg"
            alt="Sign Out"
            width={24}
            height={24}
          />
        </button>
      </div>
      {/* Styles */}
      <style jsx global>{`
        .account-menu-bubble {
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 8px 32px 0 rgba(20,22,46, 0.13);
          border: 1.5px solid #e6e7f3;
          padding: 14px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 13px;
          animation: scaleFadeInBubble .18s;
        }
        .icon-bubble-button {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: none;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none; outline: none;
          font-size: 1.25em;
          cursor: pointer;
          transition: background 0.17s;
        }
        .icon-bubble-button:hover {
          background: #f4f4fa;
        }
        @keyframes scaleFadeInBubble {
          from { opacity: 0; transform: scale(0.90);}
          to { opacity: 1; transform: scale(1);}
        }
      `}</style>
    </>
  );
}