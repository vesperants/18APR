// src/lib/search-engine/index.ts
import { processQueryWithGemini } from "./queryProcessor";
import { queryOpenAIAssistant } from "./openaiAssistant";
import { processAssistantText } from "./textExtractor";
import { storeInTempBucket, retrieveFromTempBucket } from "./tempBucket";
import type {
  LegalSearchChainOutput,
} from "./types";
import { DEBUG } from "./config";
const logPrefix = "[SearchEngine Chain]";

export async function runLegalSearchChain({
  userQuery,
  extractToggle,
  uid,
  conversationId,
  toolCallId,
  toolCallTitle // (for Firestore key)
}: {
  userQuery: string,
  extractToggle: boolean,
  uid: string,
  conversationId: string,
  toolCallId: string,
  toolCallTitle: string
}): Promise<LegalSearchChainOutput> {
  try {
    if (DEBUG) console.log(`${logPrefix} Received query: "${userQuery}", extractToggle=${extractToggle}`);

    // 1. Process query by Gemini
    const processed = await processQueryWithGemini({ query: userQuery });

    // 2. Pass processed query to OpenAI Assistant
    const openaiResult = await queryOpenAIAssistant({ query: processed.processedQuery });

    // 3. Send OpenAI result into textExtractor (with toggle)
    const extractorOut = await processAssistantText({
      assistantText: openaiResult.response,
      toggleExtract: extractToggle,
    });

    // 4. Store the result in Firestore (per tool call, with title as key)
    await storeInTempBucket({
      uid,
      conversationId,
      toolCallId,
      key: toolCallTitle,
      content: extractorOut.extractedText,
    });

    // 5. Return output
    return {
      finalText: extractorOut.extractedText,
      filesFetched: extractorOut.filesUsed || [],
    };
  } catch (err) {
    return {
      finalText: "",
      filesFetched: [],
      error: (err as Error)?.message || "Unknown error",
    };
  }
}