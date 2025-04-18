// src/lib/search-engine/tempBucket.ts

import { adminDb } from '@/services/firebase/admin';

export async function storeInTempBucket({
  uid,
  conversationId,
  toolCallId,
  key,
  content
}: {
  uid: string,
  conversationId: string,
  toolCallId: string,
  key: string,
  content: string
}) {
  await adminDb
    .collection('users').doc(uid)
    .collection('conversations').doc(conversationId)
    .collection('toolCalls').doc(toolCallId)
    .set({
      key,
      content,
      createdAt: new Date()
    });
}

export async function retrieveFromTempBucket({
  uid,
  conversationId,
  toolCallId,
  key
}: {
  uid: string,
  conversationId: string,
  toolCallId: string,
  key: string
}) {
  const docSnap = await adminDb
    .collection('users').doc(uid)
    .collection('conversations').doc(conversationId)
    .collection('toolCalls').doc(toolCallId)
    .get();

  if (!docSnap.exists) return null;
  const data = docSnap.data();
  if (!data || data.key !== key) return null;
  return data;
}