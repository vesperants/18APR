//src/app/chat/page.tsx

'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/constants/translations';
import { sendMessageToApi } from '@/services/chatService';
import { readFileAsBase64 } from '@/utils/fileUtils';
import ChatHeader from '@/components/ChatHeader';
import ChatInputArea from '@/components/ChatInputArea';
import ChatMessageList from '@/components/ChatMessageList';
import InitialGreeting from '@/components/InitialGreeting';
import ChatShelf from '@/components/ChatShelf';
import ProfileModal from '@/components/ProfileModal';
import AccountMenuBubble from '@/components/AccountMenuBubble';
import SignOutConfirmModal from '@/components/SignOutConfirmModal';
import { setupNewUserFirestore } from '@/services/firebase/userOnboarding';
import {
  getConversationList,
  getConversationMessages,
  createConversation,
  addMessageToConversation,
  deleteConversation,
} from '@/services/firebase/conversation';

interface SelectedFile { file: File; id: string; }
type BotWord = { word: string; fading: boolean };
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  wordsBatches?: BotWord[][];
  timestamp: Date;
  id?: string;
}

export default function ChatPage() {
  const BATCH_SIZE = 4;
  const FADE_DURATION_MS = 1200;

  const { user, loading, signOut } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isBotReplying, setIsBotReplying] = useState(false);
  const [isInitialState, setIsInitialState] = useState(true);
  const [isShelfOpen, setIsShelfOpen] = useState(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(80);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const stopTypingRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputAreaWrapperRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationList, setConversationList] = useState<any[]>([]);
  const [onboardingDone, setOnboardingDone] = useState<boolean>(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState<boolean>(true);

  // On mount: check onboarding, load conversations, load initial messages
  useEffect(() => {
    if (loading) return;
    if (!user || !user.emailVerified) {
      router.push('/login');
      return;
    }
    const init = async () => {
      setCheckingOnboarding(true);
      try {
        const convos = await getConversationList(user.uid);
        if (convos.length === 0) {
          await setupNewUserFirestore(user.uid, {
            email: user.email ?? '',
            name: user.displayName || '',
            companyName: '',
            address: '',
            phoneNumber: '',
          });
          const newConvos = await getConversationList(user.uid);
          setConversationList(newConvos);
          if (newConvos.length > 0) setConversationId(newConvos[0].id);
          setOnboardingDone(true);
        } else {
          setConversationList(convos);
          setConversationId(convos[0]?.id ?? null);
          setOnboardingDone(true);
        }
      } catch (e) {
        await setupNewUserFirestore(user.uid, {
          email: user.email ?? '',
          name: user.displayName || '',
          companyName: '',
          address: '',
          phoneNumber: '',
        });
        const newConvos = await getConversationList(user.uid);
        setConversationList(newConvos);
        if (newConvos.length > 0) setConversationId(newConvos[0].id);
        setOnboardingDone(true);
      } finally {
        setCheckingOnboarding(false);
      }
    };
    init();
    // eslint-disable-next-line
  }, [user, loading, router]);

  // Fetch messages for active conversation
  useEffect(() => {
    if (!conversationId || !user) return;
    const fetchMessages = async () => {
      const msgs = await getConversationMessages(user.uid, conversationId);
      const normalized = msgs.map((m: any) => ({
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(),
        id: m.id,
      }));
      setChatHistory(normalized);
      setIsInitialState(
        normalized.length === 0 ||
        (normalized.length === 1 && normalized[0].sender === 'bot')
      );
    };
    fetchMessages();
  }, [conversationId, user]);

  // Handle deleting a conversation
  const handleDeleteConversation = async (idToDelete: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to permanently delete this conversation?')) return;
    try {
      await deleteConversation(user.uid, idToDelete);
      const updatedList = conversationList.filter(c => c.id !== idToDelete);
      setConversationList(updatedList);
      if (conversationId === idToDelete) {
        setConversationId(updatedList[0]?.id ?? null);
        setChatHistory([]);
      }
    } catch (e) {
      alert('Failed to delete conversation.');
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !conversationId || !message.trim() && selectedFiles.length === 0) return;
    stopTypingRef.current = false;
    if (isInitialState) setIsInitialState(false);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Add user message to Firestore
    const userMsgId = await addMessageToConversation({
      uid: user.uid,
      conversationId,
      sender: 'user',
      text: message.trim(),
    });
    setChatHistory(prev => [
      ...prev,
      { sender: 'user', text: message.trim(), timestamp: new Date(), id: userMsgId },
    ]);

    // Read files (if any)
    let filesPayload: Awaited<ReturnType<typeof readFileAsBase64>>[] = [];
    try {
      filesPayload = await Promise.all(selectedFiles.map(f => readFileAsBase64(f.file)));
    } catch (fileReadError) {
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `Error processing files: ${fileReadError instanceof Error ? fileReadError.message : 'Unknown error'}`,
          timestamp: new Date(),
          id: Date.now().toString() + '-filereaderror',
        }
      ]);
      setIsBotReplying(false);
      setSelectedFiles([]);
      return;
    }

    setMessage('');
    setSelectedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = '40px';
    setIsBotReplying(true);
    // Prepare bot response shell in UI
    const botResponseId = `bot_${Date.now()}`;
    setChatHistory(prev => [
      ...prev,
      { sender: 'bot', text: '', wordsBatches: [], timestamp: new Date(), id: botResponseId }
    ]);
    try {
      // API HISTORY: Provide role/parts, but also send uid/conversationId!
      const historyForApi = (await getConversationMessages(user.uid, conversationId))
        .map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));

      const response = await sendMessageToApi({
        message: message.trim(),
        history: historyForApi,
        files: filesPayload,
        uid: user.uid,
        conversationId,
      }, controller.signal);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error details');
        setChatHistory(prev =>
          prev.map(msg =>
            msg.id === botResponseId
              ? { ...msg, text: controller.signal.aborted ? '(Stopped by user)' : `Error: ${response.statusText}. ${errorText}` }
              : msg
          )
        );
        setIsBotReplying(false);
        abortControllerRef.current = null;
        return;
      }

      // --- Streaming batching logic
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader found');
      const decoder = new TextDecoder();
      let textSoFar = '';
      let buffer = '';
      let pendingBatch: BotWord[] = [];
      let allBatches: BotWord[][] = [];

      function extractWords(input: string) {
        const matches = Array.from(input.matchAll(/([^\s]+[\s]*)/g));
        const allWords = matches.map(m => m[0]);
        let remainder = "";
        if (allWords.length && !/\s$/.test(allWords[allWords.length - 1]) && !/\s$/.test(input)) {
          remainder = allWords.pop()!;
        }
        return { words: allWords, remainder };
      }

      let doneReading = false;
      while (!doneReading && !stopTypingRef.current) {
        const { done, value } = await reader.read();
        if (done) doneReading = true;
        if (value) {
          const chunkText = decoder.decode(value, { stream: true });
          textSoFar += chunkText;
          buffer += chunkText;
          const { words: newWordsRaw, remainder } = extractWords(buffer);
          buffer = remainder;
          for (let w of newWordsRaw) {
            pendingBatch.push({ word: w, fading: false });
            if (pendingBatch.length === BATCH_SIZE) {
              allBatches = [...allBatches, pendingBatch];
              const batchesSnapshot = allBatches.map(batch => batch.slice());
              setChatHistory(prev => prev.map(msg =>
                msg.id === botResponseId
                  ? { ...msg, text: textSoFar, wordsBatches: batchesSnapshot }
                  : msg
              ));
              pendingBatch = [];
            }
          }
        }
        await new Promise(res => setTimeout(res, 2));
      }
      if (buffer.length > 0) pendingBatch.push({ word: buffer, fading: false });
      if (pendingBatch.length > 0) {
        allBatches = [...allBatches, pendingBatch];
        const batchesSnapshot = allBatches.map(batch => batch.slice());
        setChatHistory(prev => prev.map(msg =>
          msg.id === botResponseId
            ? { ...msg, text: textSoFar, wordsBatches: batchesSnapshot }
            : msg
        ));
      }
      if (stopTypingRef.current) {
        setChatHistory(prev =>
          prev.map(msg => msg.id === botResponseId ? { ...msg, text: textSoFar + ' (Stopped)' } : msg)
        );
      }
      // Store bot reply in Firestore
      await addMessageToConversation({
        uid: user.uid,
        conversationId,
        sender: 'bot',
        text: textSoFar,
      });
    } catch (err) {
      setChatHistory(prev =>
        prev.map(msg =>
          msg.id === botResponseId
            ? { ...msg, text: translations.errorMessage[language] }
            : msg
        )
      );
    } finally {
      setIsBotReplying(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    stopTypingRef.current = true;
    setIsBotReplying(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      (message.trim() || selectedFiles.length > 0) &&
      !isBotReplying
    ) {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newlySelectedRawFiles = Array.from(event.target.files);
      const newFilesWithIds = newlySelectedRawFiles.map(file => ({
        file,
        id: `${file.name}-${file.lastModified}-${file.size}`
      }));
      setSelectedFiles(prevFiles => {
        const existingFileIds = new Set(prevFiles.map(f => f.id));
        return [
          ...prevFiles,
          ...newFilesWithIds.filter(newFile => !existingFileIds.has(newFile.id))
        ];
      });
      event.target.value = '';
    }
  };
  const removeSelectedFile = (idToRemove: string) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file.id !== idToRemove));
  };

  useEffect(() => {
    const measureHeight = () => {
      if (inputAreaWrapperRef.current) {
        const newHeight = inputAreaWrapperRef.current.offsetHeight + 15;
        setInputAreaHeight(newHeight);
      }
    };
    measureHeight();
    const timeoutId = setTimeout(measureHeight, 50);
    return () => clearTimeout(timeoutId);
  }, [message, selectedFiles, isInitialState]);

  if (
    loading ||
    !language ||
    checkingOnboarding ||
    (!loading && (!user || !user.emailVerified))
  ) {
    const loadingText = language
      ? translations.loadingOrAccessDenied[language]
      : 'Loading...';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="container" style={{ textAlign: 'center' }}>{loadingText}</div>
      </div>
    );
  }

  // Strict batch-fading bot message renderer
  function BatchFade({ show, children, duration = 1000 }: { show: boolean, children: React.ReactNode, duration?: number }) {
    const [fadeState, setFadeState] = useState<'hidden' | 'fading' | 'shown'>(show ? 'fading' : 'hidden');
    useEffect(() => {
      if (show && fadeState === 'hidden') {
        requestAnimationFrame(() => setFadeState('fading'));
      } else if (!show) {
        setFadeState('hidden');
      }
    }, [show]);
    useEffect(() => {
      let t: any;
      if (fadeState === 'fading') {
        t = setTimeout(() => setFadeState('shown'), duration);
      }
      return () => clearTimeout(t);
    }, [fadeState, duration]);
    let style: React.CSSProperties = {
      display: 'inline',
      opacity: 1,
      transition: `opacity ${duration}ms linear`
    };
    if (fadeState === 'hidden') {
      style.opacity = 0;
      style.transition = 'none';
    }
    if (fadeState === 'fading') {
      style.opacity = 1;
    }
    return <span style={style}>{children}</span>;
  }
  const renderBotMessage = (msg: ChatMessage) => {
    if (!msg.wordsBatches || msg.wordsBatches.length === 0) return msg.text;
    return msg.wordsBatches.map((batch, batchIdx) =>
      <BatchFade show={true} duration={FADE_DURATION_MS} key={batchIdx}>
        {batch.map((w, wi) => (
          <span
            key={wi}
            style={{ whiteSpace: /\s/.test(w.word) ? 'pre' : undefined }}
          >
            {w.word}
          </span>
        ))}
      </BatchFade>
    );
  };

  return (
    <>
      {/* Modals & overlays */}
      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      <AccountMenuBubble
        open={accountMenuOpen}
        anchorRef={avatarButtonRef}
        onClose={() => setAccountMenuOpen(false)}
        language={language}
        onSignOut={() => { setAccountMenuOpen(false); setShowSignOutModal(true); }}
        onOpenProfile={() => { setAccountMenuOpen(false); setProfileModalOpen(true); }}
      />
      <SignOutConfirmModal
        open={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={async () => { setShowSignOutModal(false); await signOut(); }}
      />
      {/* Modal ChatShelf, overlays when open */}
      <ChatShelf
        isOpen={isShelfOpen}
        onClose={() => setIsShelfOpen(false)}
        conversationList={conversationList}
        activeConversationId={conversationId}
        onSelectConversation={id => setConversationId(id)}
        onNewConversation={async () => {
          if (!user) return;
          const docRef = await createConversation(user.uid, translations.untitledChat[language]);
          setConversationList(await getConversationList(user.uid));
          setConversationId(docRef.id);
          setChatHistory([]);
        }}
        onDeleteConversation={handleDeleteConversation}
      />
      <div style={{
        display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden'
      }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: '#fff', position: 'relative'
        }}>
          <ChatHeader
            onProfileClick={() => setAccountMenuOpen(open => !open)}
            profileImageUrl={user?.photoURL ?? undefined}
            title={translations.chatTitle[language]}
            onToggleShelfClick={() => setIsShelfOpen(prev => !prev)}
            isShelfOpen={isShelfOpen}
            avatarButtonRef={avatarButtonRef}
          />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Initial greeting overlay */}
            <div style={{
              position: 'absolute', top: 'calc(50% - 140px)', left: '50%',
              transform: 'translateX(-50%)', width: '90%', maxWidth: '800px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '0 20px',
              opacity: isInitialState ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out',
              pointerEvents: isInitialState ? 'auto' : 'none',
              zIndex: 4
            }}>
              <InitialGreeting language={language} />
            </div>
            {/* Chat message area */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              bottom: isInitialState ? 0 : `${inputAreaHeight}px`,
              opacity: isInitialState ? 0 : 1,
              transition: 'opacity 0.5s 0.2s ease-in-out, bottom 0.3s ease-out',
              zIndex: 2
            }}>
              <ChatMessageList
                chatHistory={chatHistory}
                language={language}
                translations={translations}
                isBotReplying={isBotReplying}
                stopTypingRef={stopTypingRef}
                renderBotMessage={renderBotMessage}
                chatContainerRef={chatContainerRef}
              />
            </div>
          </div>
          {/* Input */}
          <div
            ref={inputAreaWrapperRef}
            style={{
              position: 'absolute', left: '50%', width: '90%', maxWidth: '800px',
              bottom: isInitialState ? 'auto' : '35px',
              top: isInitialState ? '50%' : 'auto',
              transform: 'translateX(-50%)' + (isInitialState ? ' translateY(-50%)' : ''),
              transition: 'top 0.5s linear, bottom 0.5s linear, transform 0.5s linear',
              zIndex: 3
            }}>
            <ChatInputArea
              ref={textareaRef}
              message={message}
              setMessage={setMessage}
              handleSendMessage={handleSendMessage}
              handleStopGenerating={handleStopGenerating}
              handleKeyDown={handleKeyDown}
              handleFileChange={handleFileChange}
              removeSelectedFile={removeSelectedFile}
              selectedFiles={selectedFiles}
              isBotReplying={isBotReplying}
              placeholder={translations.typeMessage[language] || ''}
            />
          </div>
        </div>
      </div>
    </>
  );
}