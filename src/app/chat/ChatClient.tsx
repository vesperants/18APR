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
  subscribeToConversationList,
  subscribeToConversationMessages,
  updateConversationTitle,
} from '@/services/firebase/conversation';
import styles from './chat.module.css';

// --- Types ---
type ConversationListItem = { id: string; title: string };
interface SelectedFile { file: File; id: string; }
type BotWord = { word: string; fading: boolean };
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  wordsBatches?: BotWord[][];
  timestamp: Date;
  id?: string;
  toolCallId?: string;
}

// Improve the section cache structure with title-only and full content phases
interface SectionTitle {
  id: string;
  title: string;
  fileName: string;
}

interface SectionContent extends SectionTitle {
  content: string;
}

interface SectionCache {
  [toolCallId: string]: {
    // Track loading state
    titlesLoaded: boolean;
    contentsLoading: boolean;
    contentsLoaded: boolean;
    // Fast lookup by ID
    titles: {[sectionId: string]: SectionTitle};
    contents: {[sectionId: string]: SectionContent};
    // Organization by file
    titlesByFile: {[fileName: string]: SectionTitle[]};
    contentsByFile: {[fileName: string]: SectionContent[]};
  };
}

// Hierarchical section structure from API
interface HierarchicalSection {
  blockId: string;
  pcsId: string;
  title: string;
}

interface HierarchicalChapter {
  chapterId: string;
  title: string;
  sections: HierarchicalSection[];
}

interface HierarchicalPart {
  partId: string;
  title: string;
  chapters: HierarchicalChapter[];
}

interface HierarchicalDocument {
  documentId: string;
  parts: HierarchicalPart[];
}

interface HierarchicalFile {
  fileId: string;
  title: string;
  documents: HierarchicalDocument[];
}

interface HierarchicalSectionsResponse {
  messageId: string;
  conversationId: string;
  toolCallId: string;
  message: string;
  files: HierarchicalFile[];
}

// Interface for hierarchical section content response
interface SectionWithContent extends HierarchicalSection {
  content: string;
}

interface ChapterWithContent extends HierarchicalChapter {
  sections: SectionWithContent[];
}

interface PartWithContent extends HierarchicalPart {
  chapters: ChapterWithContent[];
}

interface DocumentWithContent extends HierarchicalDocument {
  parts: PartWithContent[];
}

interface FileWithContent extends HierarchicalFile {
  documents: DocumentWithContent[];
}

interface HierarchicalContentsResponse {
  success: boolean;
  messageId: string;
  conversationId: string;
  toolCallId: string;
  message: string;
  files: FileWithContent[];
}

// Define interface for node type to replace 'any'
interface HierarchyNodeDisplay {
  nodeId: string;
  nodeType: string;
  nodeTitle: string;
  content?: string;
  children?: HierarchyNodeDisplay[];
  metadata?: Record<string, string>;
}

interface DocumentDisplay {
  documentId: string;
  documentTitle?: string;
  nodes?: HierarchyNodeDisplay[];
  documentStructure?: {
    format?: string;
    levels?: string[];
    levelSeparator?: string;
    levelPrefixes?: Record<string, string>;
  };
}

export default function ChatClient() {
  const BATCH_SIZE = 1;
  const FADE_DURATION_MS = 1200;
  const { user, loading, signOut } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isBotReplying, setIsBotReplying] = useState(false);
  const isBotReplyingRef = useRef<boolean>(false);
  useEffect(() => { isBotReplyingRef.current = isBotReplying; }, [isBotReplying]);

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
  const [conversationList, setConversationList] = useState<ConversationListItem[]>([]);
  const [onboardingDone, setOnboardingDone] = useState<boolean>(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState<boolean>(true);

  // Scroll lock logic for manual scroll
  const [autoScroll, setAutoScroll] = useState(true);
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (isBotReplyingRef.current && el) {
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        setAutoScroll(isNearBottom);
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isBotReplying, autoScroll]);

  // Optimistically reorder (and optionally rename) a conversation in the shelf
  const updateLocalShelf = (id: string, newTitle?: string) => {
    setConversationList(prev => {
      const filtered = prev.filter(c => c.id !== id);
      const existing = prev.find(c => c.id === id);
      const title = newTitle ?? existing?.title ?? translations.untitledChat[language];
      return [{ id, title }, ...filtered];
    });
  };

  // Section modal logic
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionContent, setSectionContent] = useState({ title: '', content: '', loading: false });

  // Replace the old section cache with the new structured one
  const [sectionCache, setSectionCache] = useState<SectionCache>({});

  // Onboarding / conversation list subscription
  useEffect(() => {
    if (loading) return;
    if (!user || !user.emailVerified) {
      router.replace('/login');
      return;
    }
    setCheckingOnboarding(true);
    const unsubscribe = subscribeToConversationList(
      user.uid,
      async (convos: Array<{ id: string; title?: string }>) => {
        if (!onboardingDone) {
          if (convos.length === 0) {
            try {
              await setupNewUserFirestore(user.uid, {
                email: user.email ?? '',
                name: user.displayName || '',
                companyName: '',
                address: '',
                phoneNumber: '',
              });
            } catch (err) {
              console.error('Error during onboarding setup:', err);
            }
            return;
          }
          const mapped = convos.map(c => ({ id: c.id, title: c.title || '' }));
          setConversationList(mapped);
          setOnboardingDone(true);
          setCheckingOnboarding(false);
        } else {
          setConversationList(convos.map(c => ({ id: c.id, title: c.title || '' })));
          if (!conversationId && convos.length) {
            setConversationId(convos[0].id);
          }
        }
      },
      err => {
        console.error('Subscription error (conversations):', err);
        setCheckingOnboarding(false);
      }
    );
    return () => unsubscribe();
  }, [user, loading, router]);

  // Messages subscription
  useEffect(() => {
    if (!conversationId || !user) return;
    const unsubscribe = subscribeToConversationMessages(
      user.uid,
      conversationId,
      // msgs: Array<{ id: string; sender: string; text: string; timestamp: unknown; toolCallId?: string }>
      msgs => {
        setIsInitialState(false);
        if (isBotReplyingRef.current) return;
        const normalized = msgs.map(m => {
          // Fix for Firestore timestamp conversion with type guard
          const ts = (m.timestamp && typeof (m.timestamp as { toDate?: () => Date }).toDate === 'function')
            ? (m.timestamp as { toDate: () => Date }).toDate()
            : new Date();

          // --- BEGIN PATCH: Extract toolCallId from JSON text if not present ---
          let toolCallId = m.toolCallId;
          if (!toolCallId && typeof m.text === 'string') {
            try {
              const parsed = JSON.parse(m.text);
              if (parsed && typeof parsed === 'object' && parsed.toolCallId) {
                toolCallId = parsed.toolCallId;
              }
            } catch {
              // Not JSON, ignore
            }
          }
          // --- END PATCH ---

          return {
            sender: m.sender as 'user' | 'bot',
            text: m.text,
            timestamp: ts,
            id: m.id,
            toolCallId,
          };
        });
        setChatHistory(normalized);
      },
      err => console.error('Subscription error (messages):', err)
    );
    return () => unsubscribe();
  }, [conversationId, user]);

  // Find section in cache - with graceful fallbacks
  const findSectionInCache = (toolCallId: string | undefined, sectionId: string): { 
    title: SectionTitle | null; 
    content: SectionContent | null;
    isLoading: boolean;
  } => {
    if (!toolCallId || !sectionCache[toolCallId]) {
      return { title: null, content: null, isLoading: false };
    }
    
    const cache = sectionCache[toolCallId];
    const title = cache.titles[sectionId] || null;
    const content = cache.contents[sectionId] || null;
    const isLoading = cache.contentsLoading && !cache.contentsLoaded;
    
    return { title, content, isLoading };
  };
  
  // Load section titles (fast first phase)
  const loadSectionTitles = async (toolCallId: string) => {
    if (!user || !conversationId || !toolCallId) return;
    
    console.log(`[DEBUG] Loading section titles for tool call: ${toolCallId}`);
    
    try {
      // Check if titles already loaded
      if (sectionCache[toolCallId]?.titlesLoaded) {
        console.log(`[DEBUG] Titles for tool call ${toolCallId} already in cache`);
        return;
      }
      
      // Initialize cache for this tool call if not exists
      if (!sectionCache[toolCallId]) {
        setSectionCache(prevCache => ({
          ...prevCache,
          [toolCallId]: {
            titlesLoaded: false,
            contentsLoading: false,
            contentsLoaded: false,
            titles: {},
            contents: {},
            titlesByFile: {},
            contentsByFile: {}
          }
        }));
      }
      
      // Fetch just the titles (fast)
      const response = await fetch(`/api/sections?uid=${user.uid}&conversationId=${conversationId}&toolCallId=${toolCallId}`);
      
      if (!response.ok) {
        console.error(`[DEBUG] Failed to fetch section titles: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json() as HierarchicalSectionsResponse;
      console.log('[DEBUG] Received hierarchical sections data:', data);
      
      if (!data || !data.files || !Array.isArray(data.files) || data.files.length === 0) {
        console.log(`[DEBUG] No section titles found for tool call ${toolCallId}`);
        
        // Mark as loaded even if empty
        setSectionCache(prevCache => ({
          ...prevCache,
          [toolCallId]: {
            ...(prevCache[toolCallId] || {
              titles: {},
              contents: {},
              titlesByFile: {},
              contentsByFile: {}
            }),
            titlesLoaded: true
          }
        }));
        return;
      }
      
      // Process hierarchical titles
      const titles: {[sectionId: string]: SectionTitle} = {};
      const titlesByFile: {[fileName: string]: SectionTitle[]} = {};
      
      // Process each file in the hierarchical structure
      data.files.forEach((file: HierarchicalFile) => {
        const fileName = file.fileId;
        
        // Initialize titlesByFile array for this file
        if (!titlesByFile[fileName]) {
          titlesByFile[fileName] = [];
        }
        
        // Process each document in the file
        file.documents.forEach((document: HierarchicalDocument) => {
          // Process each part in the document
          document.parts.forEach((part: HierarchicalPart) => {
            // Process each chapter in the part
            part.chapters.forEach((chapter: HierarchicalChapter) => {
              // Process each section in the chapter
              chapter.sections.forEach((section: HierarchicalSection) => {
                const sectionId = section.pcsId;
                
                const sectionTitle: SectionTitle = {
                  id: sectionId,
                  title: section.title || '',
                  fileName
                };
                
                // Add to byId index
                titles[sectionId] = sectionTitle;
                
                // Add to byFile index
                titlesByFile[fileName].push(sectionTitle);
              });
            });
          });
        });
      });
      
      // Update cache with titles
      setSectionCache(prevCache => ({
        ...prevCache,
        [toolCallId]: {
          ...(prevCache[toolCallId] || {
            contents: {},
            contentsByFile: {},
            contentsLoading: false,
            contentsLoaded: false
          }),
          titles,
          titlesByFile,
          titlesLoaded: true
        }
      }));
      
      console.log(`[DEBUG] Cached ${Object.keys(titles).length} section titles across ${Object.keys(titlesByFile).length} documents`);
      // --- ADDED: Log and trigger background fetch for all contents ---
      console.log('[DEBUG] Triggering background fetch for all section contents for toolCallId:', toolCallId);
      loadSectionContents(toolCallId);
    } catch (error) {
      console.error('[DEBUG] Error loading section titles:', error);
    }
  };

  // Load full section contents (background second phase)
  const loadSectionContents = async (toolCallId: string) => {
    if (!user || !conversationId || !toolCallId) return;
    
    try {
      // Check if content already loaded or loading
      if (sectionCache[toolCallId]?.contentsLoaded || sectionCache[toolCallId]?.contentsLoading) {
        console.log(`[DEBUG] Section contents for ${toolCallId} already loaded or loading`);
        return;
      }
      
      console.log(`[DEBUG] Starting background load of section contents for tool call: ${toolCallId}`);
      
      // Mark as loading
      setSectionCache(prevCache => ({
        ...prevCache,
        [toolCallId]: {
          ...(prevCache[toolCallId] || {
            titlesLoaded: false,
            titles: {},
            titlesByFile: {},
            contents: {},
            contentsByFile: {}
          }),
          contentsLoading: true
        }
      }));
      
      // Fetch full content in background
      const response = await fetch(`/api/get-sections?uid=${user.uid}&conversationId=${conversationId}&toolCallId=${toolCallId}`);
      
      if (!response.ok) {
        console.error(`[DEBUG] Failed to fetch section contents: ${response.status} ${response.statusText}`);
        
        // Mark as not loading but not loaded
        setSectionCache(prevCache => ({
          ...prevCache,
          [toolCallId]: {
            ...(prevCache[toolCallId] || {}),
            contentsLoading: false
          }
        }));
        return;
      }
      
      const data = await response.json() as HierarchicalContentsResponse;
      
      if (!data.success || !data.files || !Array.isArray(data.files) || data.files.length === 0) {
        console.log(`[DEBUG] No section contents found for tool call ${toolCallId}`);
        
        // Mark as loaded even if empty
        setSectionCache(prevCache => ({
          ...prevCache,
          [toolCallId]: {
            ...(prevCache[toolCallId] || {}),
            contentsLoading: false,
            contentsLoaded: true
          }
        }));
        return;
      }
      
      // Process hierarchical contents
      const contents: {[sectionId: string]: SectionContent} = {};
      const contentsByFile: {[fileName: string]: SectionContent[]} = {};
      
      // Process each file in the hierarchical structure
      data.files.forEach((file: FileWithContent) => {
        const fileName = file.fileId;
        
        // Initialize contentsByFile array for this file
        if (!contentsByFile[fileName]) {
          contentsByFile[fileName] = [];
        }
        
        // Process each document in the file
        file.documents.forEach((document: DocumentWithContent) => {
          // Process each part in the document
          document.parts.forEach((part: PartWithContent) => {
            // Process each chapter in the part
            part.chapters.forEach((chapter: ChapterWithContent) => {
              // Process each section in the chapter
              chapter.sections.forEach((section: SectionWithContent) => {
                const sectionId = section.pcsId;
                const content = section.content || '';
                
                const sectionContent: SectionContent = {
                  id: sectionId,
                  title: section.title || '',
                  fileName,
                  content
                };
                
                // Add to byId index
                contents[sectionId] = sectionContent;
                
                // Add to byFile index
                contentsByFile[fileName].push(sectionContent);
              });
            });
          });
        });
      });
      
      // Debug: print the fetched section contents
      console.log(`[DEBUG] Background fetched section contents for toolCallId ${toolCallId}:`, contents);
      
      // Update cache with full content
      setSectionCache(prevCache => ({
        ...prevCache,
        [toolCallId]: {
          ...(prevCache[toolCallId] || {}),
          contents,
          contentsByFile,
          contentsLoading: false,
          contentsLoaded: true
        }
      }));
      
      console.log(`[DEBUG] Background loaded ${Object.keys(contents).length} section contents`);
    } catch (error) {
      console.error('[DEBUG] Error loading section contents:', error);
      
      // Mark as not loading
      setSectionCache(prevCache => ({
        ...prevCache,
        [toolCallId]: {
          ...(prevCache[toolCallId] || {}),
          contentsLoading: false
        }
      }));
    }
  };

  // --- DEBUG: Trace toolCallId detection and background fetch trigger ---
  useEffect(() => {
    console.log('[DEBUG] useEffect: checking for new toolCallIds in chatHistory');
    if (!user || !conversationId) return;
    const checkedToolCallIds: string[] = [];
    chatHistory.forEach(msg => {
      if (msg.sender === 'bot') {
        console.log('[DEBUG] Bot message:', msg);
        console.log('[DEBUG] toolCallId:', msg.toolCallId, 'titlesLoaded:', msg.toolCallId ? sectionCache[msg.toolCallId]?.titlesLoaded : undefined);
        if (msg.toolCallId) checkedToolCallIds.push(msg.toolCallId);
      }
      if (msg.sender === 'bot' && msg.toolCallId && !sectionCache[msg.toolCallId]?.titlesLoaded) {
        console.log('[DEBUG] Found new toolCallId, calling loadSectionTitles:', msg.toolCallId);
        loadSectionTitles(msg.toolCallId);
      }
    });
    console.log('[DEBUG] Checked toolCallIds in this pass:', checkedToolCallIds);
  }, [chatHistory, conversationId, user, sectionCache]);

  // Conversation CRUD
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
    } catch {
      alert('Failed to delete conversation.');
    }
  };
  const handleRenameConversation = async (idToRename: string, newTitle: string) => {
    if (!user) return;
    try {
      updateLocalShelf(idToRename, newTitle);
      await updateConversationTitle(user.uid, idToRename, newTitle);
    } catch (err) {
      console.error('Error renaming conversation:', err);
    }
  };

  // Send message (guard duplicate sends!)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!user || (!trimmedMessage && selectedFiles.length === 0)) return;
    if (isBotReplyingRef.current) return;
    isBotReplyingRef.current = true;

    let convoId = conversationId;
    const isNewConvo = !convoId;
    if (isNewConvo) {
      const docRef = await createConversation(user.uid, translations.untitledChat[language]);
      convoId = docRef.id;
      setConversationId(convoId);
    }
    const filesToProcess = selectedFiles;
    stopTypingRef.current = false;
    if (isInitialState) setIsInitialState(false);

    // Shelf update
      if (isNewConvo) {
        const firstWords = trimmedMessage.split(/\s+/).slice(0, 3).join(' ');
        updateLocalShelf(convoId!, firstWords);
        updateConversationTitle(user.uid, convoId!, firstWords).catch(err => console.error('Error renaming conversation:', err));
      } else {
        updateLocalShelf(convoId!);
      }

    // Abort any old typing
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Clear input UI
    setMessage('');
    setSelectedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = '40px';

    // Optimistically add user message
    const userMsgId = `user_${Date.now()}`;
    setChatHistory(prev => [
      ...prev,
      { sender: 'user', text: trimmedMessage, timestamp: new Date(), id: userMsgId }
    ]);
    // Insert placeholder bot message and timer
    const botResponseId = `bot_${Date.now()}`;
    setIsBotReplying(true);
    setChatHistory(prev => [
      ...prev,
      { sender: 'bot', text: ' ', wordsBatches: [], timestamp: new Date(), id: botResponseId }
    ]);
    const placeholderTimer = window.setTimeout(() => {
      setChatHistory(prev =>
        prev.map(msg =>
          msg.id === botResponseId
            ? { ...msg, text: translations.botTyping[language] || '...' }
            : msg
        )
      );
    }, 500);

    // Scroll immediately to bottom
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });

    addMessageToConversation({
      uid: user.uid,
      conversationId: convoId!,
      sender: 'user',
      text: trimmedMessage,
    }).catch(err => console.error('Error adding user message:', err));

    // Read files if any
    let filesPayload: Awaited<ReturnType<typeof readFileAsBase64>>[] = [];
    try {
      filesPayload = await Promise.all(filesToProcess.map(f => readFileAsBase64(f.file)));
    } catch (fileReadError) {
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `Error processing files: ${fileReadError instanceof Error ? fileReadError.message : 'Unknown error'}`,
          timestamp: new Date(),
          id: `${Date.now()}-filereaderror`,
        }
      ]);
      setIsBotReplying(false);
      isBotReplyingRef.current = false;
      return;
    }

    // Streaming
    try {
      const rawHistory = await getConversationMessages(user.uid, convoId!);
      const historyForApi = rawHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      const response = await sendMessageToApi({
        message: message.trim(),
        history: historyForApi,
        files: filesPayload,
        uid: user.uid,
        conversationId: convoId!,
      }, controller.signal, 'json');
      
      // Now also log response as JSON for comparison
      try {
        const jsonData = await response.clone().json();
        
        // Log the full JSON response
        console.log('API Response as JSON:', jsonData);
        
        // Specifically check for flexible hierarchy structure
        if (jsonData.flexibleHierarchy) {
          console.log('🔍 Flexible Hierarchy Structure (complete):', jsonData.flexibleHierarchy);
          console.log(`📚 Documents in hierarchy: ${jsonData.flexibleHierarchy.documents?.length || 0}`);
          
          // More detailed debugging information
          console.log('📊 Flexible Hierarchy Type:', typeof jsonData.flexibleHierarchy);
          console.log('📊 Documents Type:', typeof jsonData.flexibleHierarchy.documents);
          console.log('📊 Is Documents Array:', Array.isArray(jsonData.flexibleHierarchy.documents));
          
          // Log each document structure
          if (jsonData.flexibleHierarchy.documents) {
            jsonData.flexibleHierarchy.documents.forEach((doc: DocumentDisplay, i: number) => {
              console.log(`📄 Document ${i+1}: ${doc.documentTitle || doc.documentId}`);
              console.log(`  🌳 Nodes: ${doc.nodes?.length || 0}`);
              
              // Log the first few nodes to see their structure
              if (doc.nodes && doc.nodes.length > 0) {
                console.log('  First node sample:', doc.nodes[0]);
              }
            });
          }
        }
      } catch (e) {
        console.log('Could not parse response as JSON', e);
      }
      
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
        isBotReplyingRef.current = false;
        abortControllerRef.current = null;
        return;
      }

      // Batched streaming
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader found');
      const decoder = new TextDecoder();
      let textSoFar = '';
      let buffer = '';
      let pendingBatch: BotWord[] = [];
      let allBatches: BotWord[][] = [];

      // Add console log to view the response in browser
      console.log('API Response Object:', response);
      
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
          for (const w of newWordsRaw) {
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
              // AUTOSCROLL if allowed
              if (autoScroll && chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
              }
            }
          }
        }
        await new Promise(res => setTimeout(res, 2));
      }
      // Log the complete text when finished
      console.log('Complete Response Text:', textSoFar);
      
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

      await addMessageToConversation({
        uid: user.uid,
        conversationId: convoId!,
        sender: 'bot',
        text: textSoFar,
      });
    } catch {
      setChatHistory(prev =>
        prev.map(msg =>
          msg.id === botResponseId
            ? { ...msg, text: translations.errorMessage[language] }
            : msg
        )
      );
    } finally {
      clearTimeout(placeholderTimer);
      setIsBotReplying(false);
      isBotReplyingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  // Stop generating (with ref)
  const handleStopGenerating = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    stopTypingRef.current = true;
    setIsBotReplying(false);
    isBotReplyingRef.current = false;
  };

  // Keyboard handling (guard duplicate/disabled while bot typing)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      (message.trim() || selectedFiles.length > 0) &&
      !isBotReplyingRef.current
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

  useEffect(() => {
    if (!isInitialState && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = '40px';
    }
  }, [isInitialState]);

  useEffect(() => {
    if (!loading && (!user || !user.emailVerified)) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // --- ADDED: useEffect to auto-update modal when content arrives ---
  React.useEffect(() => {
    // Only run effect if modal is open and loading
    if (!sectionModalOpen || !sectionContent.loading) return;
    // Find the latest content in cache
    const toolCallId = chatHistory.find(msg => msg.sender === 'bot' && msg.toolCallId)?.toolCallId;
    if (!toolCallId) return;
    const { content } = findSectionInCache(toolCallId, sectionContent.title);
    if (content) {
      setSectionContent({
        title: content.title || sectionContent.title,
        content: content.content,
        loading: false
      });
    }
  }, [sectionCache, sectionModalOpen, sectionContent, chatHistory]);

  // Helper: build nested nodes based on documentStructure levels and metadata
  const buildHierarchy = (doc: DocumentDisplay): HierarchyNodeDisplay[] => {
    const levels = doc.documentStructure?.levels || [];
    const items = doc.nodes || [];
    // If no structure, just return flat list
    if (!levels || levels.length === 0) return items;

    // Recursive grouping function
    const groupByLevel = (
      nodes: HierarchyNodeDisplay[],
      levelIndex: number
    ): HierarchyNodeDisplay[] => {
      // If at last level, return raw nodes (no additional grouping)
      if (levelIndex >= levels.length - 1) {
        return nodes;
      }
      const levelName = levels[levelIndex];
      const keyName = `${levelName}Title`;
      const map = new Map<string, HierarchyNodeDisplay[]>();
      nodes.forEach(node => {
        const title = node.metadata?.[keyName] || 'Untitled';
        const bucket = map.get(title) || [];
        bucket.push(node);
        map.set(title, bucket);
      });
      const result: HierarchyNodeDisplay[] = [];
      map.forEach((groupNodes, title) => {
        const groupNode: HierarchyNodeDisplay = {
          nodeId: `${levelName}_${title}`,
          nodeType: levelName,
          nodeTitle: title,
          children: groupByLevel(groupNodes, levelIndex + 1),
        };
        result.push(groupNode);
      });
      return result;
    };
    return groupByLevel(items, 0);
  };

  if (loading || !language || checkingOnboarding) {
    const loadingText = language
      ? translations.loading[language]
      : 'Loading...';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="container" style={{ textAlign: 'center' }}>{loadingText}</div>
      </div>
    );
  }
  if (!loading && (!user || !user.emailVerified)) {
    return null;
  }

  // Streaming batches & section logic
  function BatchFade({ show, children, duration = 1000 }: { show: boolean, children: React.ReactNode, duration?: number }) {
    const [fadeState, setFadeState] = useState<'hidden' | 'fading' | 'shown'>(show ? 'fading' : 'hidden');
    useEffect(() => {
      if (show && fadeState === 'hidden') {
        requestAnimationFrame(() => setFadeState('fading'));
      } else if (!show) {
        setFadeState('hidden');
      }
    }, [show, fadeState]);
    useEffect(() => {
      let t: number;
      if (fadeState === 'fading') {
        t = window.setTimeout(() => setFadeState('shown'), duration);
      }
      return () => clearTimeout(t);
    }, [fadeState, duration]);
    const style: React.CSSProperties = {
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
    // Try to parse as JSON first to detect structured responses
    try {
      const parsedData = JSON.parse(msg.text);

      // Support fileContents response format
      if (
        parsedData.fileContents &&
        typeof parsedData.fileContents === 'object'
      ) {
        // Cast to typed structure
        const fileContents = parsedData.fileContents as Record<
          string,
          { sections?: Record<string, { content: string }> }
        >;
        return (
          <div className="flex flex-col space-y-4 p-3 border rounded bg-green-50">
            <h3 className="font-bold text-lg">File Contents</h3>
            {Object.entries(fileContents).map(([fileName, fileData]) => {
              const sections = fileData.sections || {};
              return (
                <div key={fileName} className="p-3 border rounded bg-white">
                  <h4 className="font-bold text-md">{fileName}</h4>
                  {Object.entries(sections).map(([sectionId, section]) => (
                    <div key={sectionId} className="mt-2">
                      <h5 className="font-medium">{sectionId}</h5>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{section.content}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      }

      // Check specifically for flexible hierarchy response
      if (parsedData.documents && Array.isArray(parsedData.documents)) {
        // Handler for section clicks
        const handleHierarchyNodeClick = (title: string, content: string) => {
          setSectionContent({
            title,
            content,
            loading: false
          });
          setSectionModalOpen(true);
        };

        return (
          <div className="flex flex-col space-y-4 p-3 border rounded bg-blue-50 w-full max-w-full overflow-hidden">
            <h3 className="font-bold text-lg">Hierarchical Legal Structure</h3>
            {(parsedData.documents as DocumentDisplay[]).map((doc: DocumentDisplay, docIdx: number) => {
              const roots = buildHierarchy(doc);
              return (
                <div key={docIdx} className="p-3 border rounded bg-white w-full overflow-hidden">
                  <h4 className="font-bold text-md">{doc.documentTitle || `Document ${docIdx + 1}`}</h4>
                  {roots.length > 0 ? (
                    <div className="mt-2 w-full overflow-hidden">
                      <RenderHierarchyNodes 
                        nodes={roots} 
                        onSectionClick={handleHierarchyNodeClick}
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No sections available</p>
                  )}
                </div>
              );
            })}
            <div className="mt-4 text-xs text-gray-500">
              <p>Tool Call ID: {parsedData.toolCallId}</p>
              <p>Documents: {parsedData.documents?.length || 0}</p>
            </div>
          </div>
        );
      }
      
      // If not a special format but still JSON, display it as a structured message
      if (typeof parsedData === 'object') {
        // Check if it's a message with typical fields
        if (parsedData.message && parsedData.timestamp) {
          return (
            <div className="flex flex-col space-y-2">
              <div className="text-md font-medium">{parsedData.message}</div>
              {parsedData.conversationId && (
                <div className="text-xs text-gray-500 mt-1">
                  <p>{new Date(parsedData.timestamp).toLocaleString()}</p>
                </div>
              )}
            </div>
          );
        } else {
          // Just render as JSON for other object types
          return (
            <div className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-[500px] p-2 bg-gray-50 rounded">
              <pre>{JSON.stringify(parsedData, null, 2)}</pre>
            </div>
          );
        }
      }
    } catch (error) {
      // Not JSON or not a structured response, continue with normal rendering
      console.log('[DEBUG] Failed to parse message as JSON:', error);
    }
    
    // Handle streaming batches if present
    if (msg.wordsBatches && msg.wordsBatches.length > 0) {
      return msg.wordsBatches.map((batch, batchIdx) =>
        <BatchFade show={true} duration={FADE_DURATION_MS} key={batchIdx}>
          {batch.map((w, wi) => <span key={wi}>{w.word}</span>)}
        </BatchFade>
      );
    }

    // Fallback: render plain text
    return <div className="whitespace-pre-wrap text-gray-900">{msg.text}</div>;
  };

  // Render hierarchy nodes with nesting: parts -> chapters -> sections
  function RenderHierarchyNodes({
    nodes,
    level = 0,
    onSectionClick,
  }: {
    nodes: HierarchyNodeDisplay[];
    level?: number;
    onSectionClick: (title: string, content: string) => void;
  }) {
    return (
      <div className="w-full overflow-hidden">
        {nodes.map(node => (
          <div
            key={node.nodeId}
            style={{ marginLeft: level * 16, width: `calc(100% - ${level * 16}px)` }}
            className="overflow-hidden mb-2"
          >
            {node.children?.length === 0 ? (
              <div
                className={`${styles.sectionButton} mb-2 max-w-full overflow-hidden text-ellipsis`}
                onClick={() => onSectionClick(
                  node.nodeTitle,
                  node.content || 'No content available')}
              >
                {node.nodeTitle}
              </div>
            ) : (
              <div className="font-semibold mt-3 mb-2 max-w-full overflow-hidden text-ellipsis">
                {node.nodeTitle}
              </div>
            )}
            
            {node.children && node.children.length > 0 && (
              <RenderHierarchyNodes 
                nodes={node.children} 
                level={level + 1} 
                onSectionClick={onSectionClick}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Section Content Modal */}
      {sectionModalOpen && (
        <div className={styles.modalOverlay} onClick={() => { setSectionModalOpen(false); setSectionContent({ title: '', content: '', loading: false }); }}>
          <div className={styles.sectionModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{sectionContent.title}</h3>
              <button className={styles.closeButton} onClick={() => { setSectionModalOpen(false); setSectionContent({ title: '', content: '', loading: false }); }}>×</button>
            </div>
            <div className={styles.modalContent}>
              {sectionContent.loading ? (
                <div className={styles.loadingSpinner}>Loading...</div>
              ) : (
                <>
                  <div className={styles.sectionLabel}>
                    {language === 'en' ? 'Section Content' : 'खण्ड सामग्री'}
                  </div>
                  <div className={styles.sectionText}>{sectionContent.content}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
      <ChatShelf
        isOpen={isShelfOpen}
        onClose={() => setIsShelfOpen(false)}
        conversationList={conversationList}
        activeConversationId={conversationId}
        onSelectConversation={id => setConversationId(id)}
        onNewConversation={async () => {
          if (!user) return;
          const docRef = await createConversation(user.uid, translations.untitledChat[language]);
          setConversationList(
            (await getConversationList(user.uid)).map((c: { id: string; title?: string }) => ({ id: c.id, title: c.title || '' }))
          );
          setConversationId(docRef.id);
          setChatHistory([]);
        }}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
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
            {/* Initial greeting overlay (centered) */}
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
              transition: 'opacity 0.5s ease-in-out, bottom 0.3s ease-out',
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
        <div
            ref={inputAreaWrapperRef}
            style={{
              position: 'absolute',
              left: '50%',
              width: '90%',
              maxWidth: '800px',
              bottom: isInitialState ? 'auto' : '35px',
              top: isInitialState ? '50%' : 'auto',
              // Anchor only the top edge in initial state so the box grows downward
              transform: 'translateX(-50%)',
              transition: isInitialState
                ? 'top 0.5s linear, bottom 0.5s linear'
                : 'none',
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