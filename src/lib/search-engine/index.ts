// src/lib/search-engine/index.ts
import { processQueryWithGemini } from "./queryProcessor";
import { queryOpenAIAssistant } from "./openaiAssistant";
import { processAssistantText } from "./textExtractor";
import { storeInTempBucket, retrieveFromTempBucket } from "./tempBucket";
import type {
  LegalSearchChainOutput,
} from "./types";
import { DEBUG } from "./config";
import { saveToolCallWithCounters, retrieveLawText } from "./toolCallStore";

export async function runLegalSearchChain({
  userQuery,
  extractToggle,
  uid,
  conversationId,
  toolCallId,
  toolCallTitle
}: {
  userQuery: string,
  extractToggle: boolean,
  uid: string,
  conversationId: string,
  toolCallId: string,
  toolCallTitle: string
}): Promise<LegalSearchChainOutput & { _toolCallId: string, _toolCallTitle: string }> {
  try {
    if (DEBUG) console.log(`[SearchEngine Chain] Received query: "${userQuery}", extractToggle=${extractToggle}`);
    const processed = await processQueryWithGemini({ query: userQuery });
    const openaiResult = await queryOpenAIAssistant({ query: processed.processedQuery });
    const extractorOut = await processAssistantText({
      assistantText: openaiResult.response,
      toggleExtract: extractToggle,
    });
    await saveToolCallWithCounters({
      uid,
      conversationId,
      toolCallId,
      key: toolCallTitle,
      content: extractorOut.extractedText,
      tokensUsed: 0 // Adjust if using token analytics
    });
    return {
      finalText: extractorOut.extractedText,
      filesFetched: extractorOut.filesUsed || [],
      _toolCallId: toolCallId,
      _toolCallTitle: toolCallTitle
    };
  } catch (err) {
    return {
      finalText: "",
      filesFetched: [],
      error: (err as Error)?.message || "Unknown error",
      _toolCallId: toolCallId,
      _toolCallTitle: toolCallTitle,
    };
  }
}
const logPrefix = "[SearchEngine Chain]";
