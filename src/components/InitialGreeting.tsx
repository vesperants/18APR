//src/components/initialGreeting.tsx

import React from 'react';
import styles from './InitialGreeting.module.css'; // Import the CSS module

/**
 * Props for the InitialGreeting component.
 */
interface InitialGreetingProps {
  /** The current language setting. */
  language: 'en' | 'ne';
}

/**
 * InitialGreeting Component
 *
 * Displays the initial welcome message in the chat interface.
 *
 * @param {InitialGreetingProps} props The component props.
 * @returns {JSX.Element} The rendered greeting component.
 */
const InitialGreeting: React.FC<InitialGreetingProps> = ({ language }) => {
  // Removed inline style objects

  return (
    // Apply styles using class names from the module
    <h2 className={styles.greetingHeading}>
      <span className={styles.greetingText}>
        {language === 'en' ? 'Hi, how can I help you today?' : 'नमस्ते, म तपाईंलाई कसरी सहयोग गर्न सक्छु?'}
      </span>
    </h2>
  );
};

export default InitialGreeting; 