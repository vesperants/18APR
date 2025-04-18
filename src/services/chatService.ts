// src/services/chatService.ts
import type { Content } from '@google/genai';

interface FilePayload {
  data: string;
  mimeType: string;
}
interface SendToApiArgs {
  message: string;
  history: Content[];
  files: FilePayload[];
  uid: string;
  conversationId: string;
}
export async function sendMessageToApi(
  { message, history, files, uid, conversationId }: SendToApiArgs,
  signal?: AbortSignal
): Promise<Response> {
  return fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, files, uid, conversationId }),
    signal,
  });
}