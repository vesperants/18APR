// src/lib/search-engine/index.ts
import { processQueryWithGemini } from "./queryProcessor";
import { queryOpenAIAssistant } from "./openaiAssistant";
import { processAssistantText } from "./textExtractor";
import type {
  HierarchicalTitlesResponse,
  FileInfo,
  DocumentInfo,
  PartInfo,
  ChapterInfo,
  SectionInfo,
  FlexibleHierarchicalResponse,
  HierarchyNode,
  DocumentHierarchy,
  DocumentStructureInfo,
  SectionTitlesRetrievalParams,
  SectionTextRetrievalParams
} from "./types";
import { DEBUG } from "./config";
import { saveToolCallWithCounters } from "./toolCallStore";
import { getFlexibleHierarchy } from "./hierarchyStore";

// Re-export only the new flexible hierarchy function
export { getFlexibleHierarchy };

// Re-export the hierarchical types
export type { 
  HierarchicalTitlesResponse, 
  FileInfo, 
  DocumentInfo, 
  PartInfo, 
  ChapterInfo, 
  SectionInfo,
  HierarchyNode,
  DocumentHierarchy,
  FlexibleHierarchicalResponse,
  DocumentStructureInfo
};

/**
 * Main search engine function that processes a user query and returns relevant legal sections
 * 
 * The search flow works as follows:
 * 1. Process user query using Gemini to refine it for legal search
 * 2. Send processed query to OpenAI Assistant trained for legal document navigation
 * 3. The Assistant returns responses with document structure information (P-C-S, P-S, etc)
 * 4. Extract text from the response and detect the document structure pattern
 * 5. Store the results in Firestore using an optimized hierarchical structure
 * 6. Return a flexible hierarchy for display in the UI
 * 
 * This system now detects and supports arbitrary document hierarchies, not just P-C-S.
 */
export async function runLegalSearchChain({
  userQuery,
  extractToggle,
  uid,
  conversationId,
  toolCallId,
  toolCallTitle,
}: {
  userQuery: string,
  extractToggle: boolean,
  uid: string,
  conversationId: string,
  toolCallId: string,
  toolCallTitle: string,
}): Promise<{
  flexibleHierarchy?: FlexibleHierarchicalResponse;
  error?: string;
}> {
  try {
    if (DEBUG) console.log(`[SearchEngine Chain] Received query: "${userQuery}", extractToggle=${extractToggle}`);
    
    // Step 1: Process the query with Gemini
    const processed = await processQueryWithGemini({ query: userQuery });
    console.log(`[SearchEngine Chain] processed query:`, processed.processedQuery);
    
    // Step 2: Query OpenAI Assistant with the processed query
    console.log(`[SearchEngine Chain] calling queryOpenAIAssistant with processedQuery`);
    const openaiResult = await queryOpenAIAssistant({ query: processed.processedQuery });
    console.log(`[SearchEngine Chain] queryOpenAIAssistant returned response:`, openaiResult.response);
    
    // Step 3: Extract content and detect document structure from the OpenAI response
    const extractorOut = await processAssistantText({
      assistantText: openaiResult.response,
      toggleExtract: extractToggle,
    });
    
    // Step 4: Save the extracted content to the database with optimized storage
    // The system automatically detects the document structure from section IDs
    await saveToolCallWithCounters({
      uid,
      conversationId,
      toolCallId,
      key: toolCallTitle,
      content: extractorOut.extractedText,
      tokensUsed: 0 // Adjust if using token analytics
    });
    
    // Step 5: Build a flexible hierarchy based on the detected structure
    const flexibleHierarchy = await getFlexibleHierarchy(
      uid,
      conversationId,
      toolCallId,
      `I've found relevant legal sections related to ${userQuery.substring(0, 50)}...`
    );
    
    console.log(`[SearchEngine Chain] Got flexible hierarchical data with ${flexibleHierarchy.documents.length} documents`);
    
    // For debugging, print the structure and hierarchy
    if (DEBUG) {
      for (const document of flexibleHierarchy.documents) {
        console.log(`[DEBUG] Document structure for ${document.documentId}:`, document.documentStructure);
      }
      console.log(`[DEBUG] Flexible hierarchy output:`, JSON.stringify(flexibleHierarchy, null, 2));
    }
    
    // Return the flexible hierarchy directly
    return { flexibleHierarchy };
  } catch (err) {
    console.error(`[SearchEngine Chain] Error during legal search chain:`, err);
    return { 
      error: (err as Error)?.message || "Unknown error"
    };
  }
}
// --- Stubbed legacy exports to satisfy existing API routes ---
/**
 * Retrieves full sections for a tool call (legacy stub).
 */
export async function getSectionsForToolCall(
  uid: string,
  conversationId: string,
  toolCallId: string
): Promise<any[]> {
  return [];
}

/**
 * Retrieves section titles for a conversation (legacy stub).
 */
export async function retrieveSectionTitles(
  params: SectionTitlesRetrievalParams
): Promise<Record<string, string>> {
  return {};
}

/**
 * Retrieves text for a specific section (legacy stub).
 */
export async function retrieveSectionText(
  params: SectionTextRetrievalParams
): Promise<string | null> {
  return null;
}

/**
 * Retrieves all section contents for a tool call (legacy stub).
 */
export async function getAllSectionsContent(
  uid: string,
  conversationId: string,
  toolCallId: string
): Promise<Record<string, any>> {
  return {};
}

/**
 * Retrieves hierarchical section titles for a tool call (legacy stub).
 */
export async function getHierarchicalSectionTitles(
  uid: string,
  conversationId: string,
  toolCallId: string,
  message?: string
): Promise<HierarchicalTitlesResponse> {
  return {
    messageId: `msg_${Date.now()}`,
    conversationId,
    toolCallId,
    message: message || '',
    files: []
  } as HierarchicalTitlesResponse;
}
