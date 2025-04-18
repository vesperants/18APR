import React from 'react';
import styles from './ChatHeader.module.css';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/constants/translations';

interface ChatHeaderProps {
  onProfileClick: () => void;
  profileImageUrl?: string;
  children?: React.ReactNode;
  title: string;
  onToggleShelfClick: () => void;
  isShelfOpen: boolean;
  avatarButtonRef: React.RefObject<HTMLButtonElement | null>;
}
const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  children,
  onProfileClick,
  profileImageUrl,
  onToggleShelfClick,
  isShelfOpen,
  avatarButtonRef,
}) => {
  const { language } = useLanguage();
  const defaultProfileImage = '/default-profile.png';
  return (
    <div className={styles.headerContainer}>
      <div className={styles.leftSection}>
        {onToggleShelfClick && (
          <button
            onClick={onToggleShelfClick}
            className={styles.headerButton}
            title={translations.toggleShelf?.[language] || 'Toggle Menu'}
            aria-label={translations.toggleShelf?.[language] || 'Toggle Menu'}
            style={{ background: 'none', border: 'none', padding: 0, marginRight: 12, cursor: 'pointer', outline: 'none' }}
          >
            <svg className={styles.toggleIcon} width={28} height={28} fill="none" viewBox="0 0 28 28">
              <rect x="5" y="8" width="18" height="2.4" rx="1.2" fill="#9a98a9"/>
              <rect x="5" y="13.8" width="18" height="2.4" rx="1.2" fill="#9a98a9"/>
              <rect x="5" y="19.6" width="9" height="2.4" rx="1.2" fill="#9a98a9"/>
            </svg>
          </button>
        )}
      </div>
      <h1 className={styles.headerTitle}>
        <span>{title}</span>
      </h1>
      <div className={styles.rightSection}>
        {children}
        {onProfileClick && (
          <button
            ref={avatarButtonRef}
            onClick={onProfileClick}
            className={styles.profileButton}
            title={translations.editProfileTooltip?.[language] || 'Edit Profile'}
            aria-label={translations.editProfileTooltip?.[language] || 'Edit Profile'}
            style={{
              marginLeft: 25,
              borderRadius: '99px',
              overflow: 'hidden',
              border: '1.7px solid #ede4fe',
              background: 'white',
              width: 44, height: 44,
              boxShadow: '0 1.5px 8px 0 rgba(22,24,34, 0.07)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              outline: 'none'
            }}
          >
            <Image
              src={profileImageUrl || defaultProfileImage}
              alt="Profile"
              width={40}
              height={40}
              className={styles.profileImage}
            />
          </button>
        )}
      </div>
    </div>
  );
};
export default ChatHeader;