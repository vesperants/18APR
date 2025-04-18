// src/lib/search-engine/toolCallStore.ts
import { adminDb } from "@/services/firebase/admin";

// Firestore increment helper
const FieldValue =
  (adminDb as any).FieldValue || require("firebase-admin").firestore.FieldValue;

/**
 * Stores the extracted / processed law text
 * and bumps the call counters.
 */
export async function saveToolCallWithCounters({
  uid,
  conversationId,
  toolCallId,
  key,
  content,
  tokensUsed = 0,
  type = "law_extract",
}: {
  uid: string;
  conversationId: string;
  toolCallId: string;
  key: string;
  content: string;
  tokensUsed?: number;
  type?: string;
}) {
  const docRef = adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("toolCalls")
    .doc(toolCallId);

  await docRef.set({
    key,
    content,
    createdAt: new Date(),
    tokensUsed,
    type,
  });

  // update counters
  await adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .update({ convoToolCalls: FieldValue.increment(1) });

  await adminDb
    .collection("users")
    .doc(uid)
    .update({ totalToolCalls: FieldValue.increment(1) });
}

/**
 * Retrieves the saved law text.
 * Tries the expected path first; if nothing is there,
 * falls back to the path that was actually used by the search tool.
 */
export async function retrieveLawText({
  uid,
  conversationId,
  toolCallId,
  key,
}: {
  uid: string;
  conversationId: string;
  toolCallId: string;
  key: string;
}): Promise<string | null> {
  // 1️⃣  Preferred location (with user ID)
  let snap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("toolCalls")
    .doc(toolCallId)
    .get();

  // 2️⃣  Fallback location (without user ID)
  if (!snap.exists) {
    snap = await adminDb
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .get();
  }

  if (!snap.exists) return null;

  const data = snap.data();
  return data ? data.content : null;
}