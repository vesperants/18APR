//src/services/firebase/userOnboarding.ts

import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from './config';

export const setupNewUserFirestore = async (
  userId: string,
  profileData: {
    email: string;
    name: string;
    companyName?: string;
    address?: string;
    phoneNumber?: string;
  }
) => {
  const userDocRef = doc(db, 'users', userId);

  await setDoc(userDocRef, {
    ...profileData,
    uid: userId,
    createdAt: serverTimestamp(),
    tier: 'free',
    totalTokens: 0,
    totalMessages: 0,
    totalToolCalls: 0,
    dailyToolCalls: {}, // e.g., { "20240607": count }
  });

  const conversationsColRef = collection(userDocRef, 'conversations');
  const welcomeConvoRef = await addDoc(conversationsColRef, {
    title: 'Welcome',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: true,
    totalTokens: 0,
    totalMessages: 1,
    convoToolCalls: 0,
  });

  await setDoc(doc(welcomeConvoRef, 'messages', 'msg_welcome'), {
    sender: 'bot',
    text: 'Welcome! 👋 Start chatting anytime.',
    timestamp: serverTimestamp(),
    tokensUsed: 0,
    isSearchResult: false,
    toolCallId: null,
  });
};