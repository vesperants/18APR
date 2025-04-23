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
  signal?: AbortSignal,
  format: 'text' | 'json' = 'text'
): Promise<Response> {
  console.log('[Chat API Request]', { message, uid, conversationId, historyLength: history.length, filesCount: files.length, format });
  
  // Build URL with format parameter if json is requested
  const url = format === 'json' ? '/api/chat?format=json' : '/api/chat';
  
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, files, uid, conversationId }),
    signal,
  });
}