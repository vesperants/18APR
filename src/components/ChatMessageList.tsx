//src/app/components/ChatMessageList.tsx

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/app/chat/chat.module.css'; // Shared chat styles (user/bot bubbles, etc.)
import listStyles from './ChatMessageList.module.css'; // Component-specific styles
import { translations } from '@/constants/translations';

// Shared chat message model (align with page.tsx)
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  id?: string;
  wordsBatches?: any; // For bot message batching/fading, optional
}

interface ChatMessageListProps {
  chatHistory: ChatMessage[];
  showCanvas?: boolean;
  language: 'en' | 'ne';
  translations: typeof translations;
  isBotReplying: boolean;
  stopTypingRef: React.RefObject<boolean>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  renderBotMessage?: (msg: ChatMessage) => React.ReactNode;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  chatHistory,
  showCanvas = false,
  language,
  translations,
  isBotReplying,
  stopTypingRef,
  chatContainerRef,
  renderBotMessage
}) => {
  // Scroll to the bottom on new message
  useEffect(() => {
    if (chatContainerRef?.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isBotReplying, chatContainerRef]);

  const messageWrapperClass = `
    ${listStyles.messageWrapper}
    ${showCanvas ? listStyles.messageWrapperCanvas : ''}
  `;

  const markdownComponents = {
    p: (props: any) => <p className={listStyles.markdownParagraph} {...props} />,
    ul: (props: any) => <ul className={listStyles.markdownList} {...props} />,
    li: (props: any) => <li className={listStyles.markdownListItem} {...props} />,
    hr: () => <></>
  };

  return (
    <div ref={chatContainerRef} className={listStyles.scrollContainer}>
      <div className={messageWrapperClass.trim()}>
        {chatHistory.map((chat, index) => {
          const isUser = chat.sender === 'user';
          const messageRowClass = `
            ${listStyles.messageRow}
            ${isUser ? listStyles.messageRowUser : listStyles.messageRowBot}
          `;
          return (
            <div key={chat.id || index} className={messageRowClass.trim()}>
              <div className={isUser ? styles.userMessageBubble : styles.botMessageBubble}>
                <span className={styles.messageSender}>
                  {isUser ? translations.you[language] : translations.botName[language]}
                </span>
                <div className={styles.messageText}>
                  {isUser ? (
                    <span>{chat.text}</span>
                  ) : renderBotMessage ? (
                    renderBotMessage(chat)
                  ) : (
                    <ReactMarkdown components={markdownComponents}>{chat.text}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Typing indicator */}
        {isBotReplying &&
          !stopTypingRef.current &&
          chatHistory.length > 0 &&
          chatHistory[chatHistory.length - 1]?.sender === 'bot' && (
            <div className={listStyles.typingIndicatorWrapper}>
              <p className={`${styles.messageText} ${listStyles.typingIndicatorText}`}>
                {translations.botTyping[language] || 'Typing...'}
              </p>
            </div>
          )}
      </div>
    </div>
  );
};
export default ChatMessageList;