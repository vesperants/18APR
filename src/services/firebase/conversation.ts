//src/services/firebase/conversation.ts

import {
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
  increment,
  onSnapshot
} from 'firebase/firestore';
import { db } from './config';

// (Add: helper to get a specific conversation)
export async function getConversation(uid: string, conversationId: string) {
  const ref = doc(db, 'users', uid, 'conversations', conversationId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createConversation(uid: string, title = "Untitled chat") {
  const conversationsRef = collection(db, 'users', uid, 'conversations');
  const docRef = await addDoc(conversationsRef, {
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: true,
    totalTokens: 0,
    totalMessages: 0,
    convoToolCalls: 0,
  });
  return docRef;
}

export async function getConversationList(uid: string) {
  const conversationsRef = collection(db, 'users', uid, 'conversations');
  const q = query(conversationsRef, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
/**
 * Subscribe to real-time updates of the user's conversation list.
 * Returns an unsubscribe function.
 */
export function subscribeToConversationList(
  uid: string,
  onUpdate: (convos: Array<{ id: string; [key: string]: any }>) => void,
  onError?: (error: Error) => void
): () => void {
  const conversationsRef = collection(db, 'users', uid, 'conversations');
  const q = query(conversationsRef, orderBy('updatedAt', 'desc'));
  const unsubscribe = onSnapshot(
    q,
    snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(data);
    },
    err => {
      if (onError) onError(err);
      console.error('Error subscribing to conversation list:', err);
    }
  );
  return unsubscribe;
}

export async function getConversationMessages(uid: string, conversationId: string) {
  const messagesRef = collection(db, 'users', uid, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
/**
 * Subscribe to real-time updates of messages in a conversation.
 * Returns an unsubscribe function.
 */
export function subscribeToConversationMessages(
  uid: string,
  conversationId: string,
  onUpdate: (msgs: Array<{ id: string; sender: string; text: string; timestamp: any }>) => void,
  onError?: (error: Error) => void
): () => void {
  const messagesRef = collection(db, 'users', uid, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  const unsubscribe = onSnapshot(
    q,
    snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(data);
    },
    err => {
      if (onError) onError(err);
      console.error('Error subscribing to conversation messages:', err);
    }
  );
  return unsubscribe;
}

/**
 * Recursively deletes all messages and toolCalls in a conversation subcollections before
 * deleting the parent conversation document.
 */
export async function deleteConversation(uid: string, conversationId: string) {
  // Delete messages subcollection
  const messagesRef = collection(db, 'users', uid, 'conversations', conversationId, 'messages');
  const messagesSnap = await getDocs(messagesRef);
  const deleteMessages = messagesSnap.docs.map(docSnap => deleteDoc(docSnap.ref));

  // Delete toolCalls subcollection (if has one)
  const toolCallsRef = collection(db, 'users', uid, 'conversations', conversationId, 'toolCalls');
  const toolCallsSnap = await getDocs(toolCallsRef);
  const deleteToolCalls = toolCallsSnap.docs.map(docSnap => deleteDoc(docSnap.ref));

  await Promise.all([...deleteMessages, ...deleteToolCalls]); // Wait for all deletes

  // Finally, delete the conversation doc
  const convoDocRef = doc(db, 'users', uid, 'conversations', conversationId);
  await deleteDoc(convoDocRef);
}

export async function addMessageToConversation({
  uid, conversationId, sender, text, isSearchResult = false, tokensUsed = 0, toolCallId = null, timestamp = new Date()
}: {
  uid: string,
  conversationId: string,
  sender: 'user' | 'bot',
  text: string,
  isSearchResult?: boolean,
  tokensUsed?: number,
  toolCallId?: string | null,
  timestamp?: Date
}) {
  const messagesCol = collection(db, 'users', uid, 'conversations', conversationId, 'messages');
  const ref = await addDoc(messagesCol, {
    sender,
    text,
    timestamp: timestamp ? timestamp : serverTimestamp(),
    tokensUsed,
    isSearchResult,
    toolCallId: toolCallId,
  });
  // Update analytics
  const convoDoc = doc(db, 'users', uid, 'conversations', conversationId);
  await updateDoc(convoDoc, {
    totalMessages: increment(1),
    totalTokens: increment(tokensUsed),
    updatedAt: serverTimestamp(),
  });
  const userDoc = doc(db, 'users', uid);
  await updateDoc(userDoc, {
    totalMessages: increment(1),
    totalTokens: increment(tokensUsed)
  });
  return ref.id;
}

export async function saveToolCall({
  uid, conversationId, title, resultData, tokensUsed
}: {
  uid: string,
  conversationId: string,
  title: string,
  resultData: object,
  tokensUsed: number
}) {
  const toolCallsCol = collection(db, 'users', uid, 'conversations', conversationId, 'toolCalls');
  const toolCallRef = await addDoc(toolCallsCol, {
    title,
    data: resultData,
    tokensUsed,
    createdAt: serverTimestamp()
  });
  // update counters
  const convoDoc = doc(db, 'users', uid, 'conversations', conversationId);
  await updateDoc(convoDoc, { convoToolCalls: increment(1) });
  const userDoc = doc(db, 'users', uid);
  const today = new Date();
  const ymd = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
  await updateDoc(userDoc, {
    totalToolCalls: increment(1),
    [`dailyToolCalls.${ymd}`]: increment(1)
  });
  return toolCallRef.id;
}
export async function getToolCall(uid: string, conversationId: string, toolCallId: string) {
  const ref = doc(db, 'users', uid, 'conversations', conversationId, 'toolCalls', toolCallId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
/**
 * Update the title of an existing conversation and bump its updatedAt timestamp.
 */
export async function updateConversationTitle(
  uid: string,
  conversationId: string,
  title: string
): Promise<void> {
  const convoDocRef = doc(db, 'users', uid, 'conversations', conversationId);
  await updateDoc(convoDocRef, { title, updatedAt: serverTimestamp() });
}