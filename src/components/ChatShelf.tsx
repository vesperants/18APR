'use client';
import React, { useCallback, useRef, useEffect, useState } from 'react';
import styles from './ChatShelf.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/constants/translations';

interface ChatShelfProps {
  isOpen: boolean;
  onClose: () => void;
  conversationList: { id: string; title: string; updatedAt?: any }[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

const ChatShelf: React.FC<ChatShelfProps> = ({
  isOpen,
  onClose,
  conversationList,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  const { language } = useLanguage();
  const shelfRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Click outside to close modal
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (shelfRef.current && !shelfRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  // Prevent click inside shelf from propagating to backdrop
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  // Handle conversation selection and close
  const handleSelectConversation = (id: string) => {
    onSelectConversation(id);
    onClose();
  };

  // Keyboard accessibility for cross button (delete)
  const handleDeleteKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDeleteConversation(id);
    }
  };

  return (
    <div
      className={`${styles.shelfBackdrop} ${!isOpen ? styles.shelfBackdropHidden : ''}`}
      style={{ display: isOpen ? 'block' : 'none' }}
      onClick={handleBackdropClick}
      aria-hidden={!isOpen}
      tabIndex={-1}
    >
      <aside
        ref={shelfRef}
        className={`${styles.shelfContainer} ${!isOpen ? styles.shelfContainerClosed : ''}`}
        onClick={stopPropagation}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className={styles.shelfHeader}>
          <h2 className={styles.shelfHeaderTitle}>
            {translations.conversations[language] || 'Conversations'}
          </h2>
        </div>
        <div className={styles.shelfContent}>
          {conversationList.length === 0 ? (
            <p className={styles.emptyMsg}>
              {translations.noConversations[language] || 'No conversations yet.'}
            </p>
          ) : (
            <ul className={styles.conversationList}>
              {conversationList.map((convo) => (
                <li
                  key={convo.id}
                  className={`${styles.conversationListItem} ${
                    convo.id === activeConversationId ? styles.activeConversation : ''
                  }`}
                  onClick={() => handleSelectConversation(convo.id)}
                  tabIndex={0}
                  aria-current={convo.id === activeConversationId ? 'true' : undefined}
                  title={convo.title}
                  onMouseEnter={() => setHoveredId(convo.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  // position: 'relative' removed, now in CSS!
                >
                  <span className={styles.conversationTitle}>
                    {convo.title || translations.untitledChat[language] || 'Untitled Chat'}
                  </span>
                  {/* Delete button */}
                  <button
                    type="button"
                    className={styles.deleteConversationButton}
                    title={translations.deleteConversation?.[language] || 'Delete this conversation'}
                    aria-label={translations.deleteConversation?.[language] || 'Delete this conversation'}
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteConversation(convo.id);
                    }}
                    onKeyDown={e => handleDeleteKeyDown(e, convo.id)}
                    tabIndex={hoveredId === convo.id ? 0 : -1}
                    style={{
                      opacity: hoveredId === convo.id ? 1 : 0,
                      pointerEvents: hoveredId === convo.id ? 'auto' : 'none',
                      // margin-left removed if present
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className={styles.newConversationButton}
            onClick={onNewConversation}
            type="button"
            aria-label={translations.newConversation[language] || 'New'}
          >
            +
          </button>
        </div>
      </aside>
    </div>
  );
};

export default ChatShelf;