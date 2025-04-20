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
  // Track whether auto-scroll is enabled; disable when user scrolls manually
  const autoScrollEnabled = useRef<boolean>(true);
  // Scroll to the bottom on new message if auto-scroll enabled
  useEffect(() => {
    const container = chatContainerRef?.current;
    if (container && autoScrollEnabled.current) {
      container.scrollTop = container.scrollHeight;
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

  // Handle user scrolling: disable auto-scroll when not at bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = el;
    // If within 20px of bottom, consider at bottom
    autoScrollEnabled.current = (scrollHeight - scrollTop - clientHeight) < 20;
  };
  return (
    <div
      ref={chatContainerRef}
      className={listStyles.scrollContainer}
      onScroll={handleScroll}
    >
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
                {/* Show sender label only for bot messages; remove 'you' label for user */}
                {!isUser && (
                  <span className={styles.messageSender}>
                    {translations.botName[language]}
                  </span>
                )}
              <div className={styles.messageText}>
                  {isUser ? (
                    <span>{chat.text}</span>
                  ) : (
                    // Bot: show inline typing indicator while placeholder has no words yet
                    isBotReplying && chat.wordsBatches?.length === 0 ? (
                      <span>{translations.botTyping[language] || '...'}</span>
                    ) : renderBotMessage ? (
                      renderBotMessage(chat)
                    ) : (
                      <ReactMarkdown components={markdownComponents}>{chat.text}</ReactMarkdown>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default ChatMessageList;