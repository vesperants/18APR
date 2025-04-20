// src/lib/search-engine/toolCallStore.ts
import { adminDb } from "@/services/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// Firestore increment helper
const firestoreFieldValue = FieldValue || 
  (adminDb as { FieldValue?: typeof FieldValue }).FieldValue;

/**
 * Parses the content of a legal search result into structured sections
 * based on PCS (Part-Chapter-Section) identifiers.
 * 
 * @param content The full text content with multiple sections
 * @returns An object with PCS identifiers as keys and section data as values
 */
function parseContentSections(content: string) {
  console.log("[DEBUG] Starting section parsing for content:", content.substring(0, 100) + "...");
  const sections: Record<string, { title: string, content: string }> = {};
  
  // First try with marker-based pattern (preferred format)
  const sectionPattern = /---- \[(P\d+-C\d+-S\d+)\] ----([\s\S]*?)(?=---- \[|$)/g;
  
  let match;
  let matchCount = 0;
  while ((match = sectionPattern.exec(content)) !== null) {
    matchCount++;
    const pcsId = match[1];
    const sectionContent = match[2].trim();
    
    // Extract section title
    const titleMatch = sectionContent.match(/Section: ([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    console.log(`[DEBUG] Found section ${pcsId} with title: ${title}`);
    
    sections[pcsId] = {
      title: title,
      content: sectionContent
    };
  }
  
  // If marker-based pattern didn't work, try direct PCS format as a fallback
  if (matchCount === 0) {
    console.log("[DEBUG] No matches with marker pattern, trying direct PCS format");
    // Look for P#-C#-S# format directly
    const directPattern = /(P\d+-C\d+-S\d+)[\s\S]*?(?=P\d+-C\d+-S|$)/g;
    while ((match = directPattern.exec(content)) !== null) {
      const pcsContent = match[0];
      const pcsId = match[1];
      
      // Extract title
      const titleMatch = pcsContent.match(/Section: ([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      console.log(`[DEBUG] Found direct section ${pcsId} with title: ${title}`);
      
      sections[pcsId] = {
        title: title,
        content: pcsContent.trim()
      };
    }
  }
  
  console.log(`[DEBUG] Parsed ${Object.keys(sections).length} sections`);
  return sections;
}

/**
 * Stores the extracted / processed law text
 * and bumps the call counters.
 * 
 * Now also parses and stores structured sections for more efficient retrieval.
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
  console.log(`[DEBUG] saveToolCallWithCounters called for toolCallId: ${toolCallId}`);
  
  // Keep original storage for backward compatibility
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
    hasExtractedSections: false, // Will be updated after extraction
  });
  
  console.log(`[DEBUG] Original content saved to toolCalls/${toolCallId}`);

  // Parse and store structured sections
  try {
    console.log(`[DEBUG] Starting section parsing for content length: ${content.length}`);
    const sectionsMap = parseContentSections(content);
    
    // Store each PCS section with title and content separately
    const batch = adminDb.batch();
    
    // Store sections under toolCalls/{toolCallId}/sections/{sectionId}
    const toolCallSectionsRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("sections");
      
    console.log(`[DEBUG] Created toolCall sections reference at path: ${toolCallSectionsRef.path}`);
    
    // Continue to store in lawSections for backward compatibility but with toolCallId field
    const lawSectionsRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("lawSections");
    
    for (const [pcsId, sectionData] of Object.entries(sectionsMap)) {
      // 1. Store under toolCall document
      const sectionRef = toolCallSectionsRef.doc(pcsId);
      console.log(`[DEBUG] Adding section ${pcsId} to toolCall batch`);
      
      batch.set(sectionRef, {
        title: sectionData.title,
        content: sectionData.content,
        createdAt: new Date()
      });
      
      // 2. Store in lawSections for backward compatibility
      const lawSectionRef = lawSectionsRef.doc(pcsId);
      console.log(`[DEBUG] Adding section ${pcsId} to lawSections batch`);
      
      batch.set(lawSectionRef, {
        title: sectionData.title,
        content: sectionData.content,
        toolCallId, // reference to original data
        createdAt: new Date()
      });
    }
    
    // Update the toolCall document to indicate it has extracted sections
    batch.update(docRef, { 
      hasExtractedSections: true,
      sectionsCount: Object.keys(sectionsMap).length,
      sectionIds: Object.keys(sectionsMap)
    });
    
    console.log(`[DEBUG] Committing batch with ${Object.keys(sectionsMap).length} sections`);
    await batch.commit();
    console.log(`[DEBUG] Batch committed successfully`);
    console.log(`[ToolCallStore] Parsed and stored ${Object.keys(sectionsMap).length} structured sections`);
  } catch (error) {
    console.error("[ToolCallStore] Error parsing or storing sections:", error);
    // Continue even if parsing fails - original content is still saved
  }

  // update conversation counter - first check if conversation exists
  const convoRef = adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId);

  const convoDoc = await convoRef.get();
  if (convoDoc.exists) {
    await convoRef.update({ convoToolCalls: firestoreFieldValue.increment(1) });
  } else {
    // Create the conversation document if it doesn't exist
    await convoRef.set({ 
      convoToolCalls: 1,
      createdAt: new Date()
    });
  }

  // update user counter
  const userRef = adminDb.collection("users").doc(uid);
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    await userRef.update({ totalToolCalls: firestoreFieldValue.increment(1) });
  } else {
    // Create the user document if it doesn't exist
    await userRef.set({ 
      totalToolCalls: 1,
      createdAt: new Date()
    });
  }
    
  console.log(`[DEBUG] saveToolCallWithCounters completed for toolCallId: ${toolCallId}`);
}

/**
 * Gets a list of all tool calls for a conversation.
 * This provides a way to see all search operations performed in a conversation.
 */
export async function getToolCallsForConversation(
  uid: string,
  conversationId: string
): Promise<Array<{id: string, key: string, createdAt: Date, sectionsCount: number}>> {
  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("toolCalls")
    .orderBy("createdAt", "desc")
    .get();
    
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      key: data.key || "",
      createdAt: data.createdAt?.toDate() || new Date(),
      sectionsCount: data.sectionsCount || 0
    };
  });
}

/**
 * Gets all sections for a specific tool call.
 * This allows retrieving all sections from a particular search operation.
 */
export async function getSectionsForToolCall(
  uid: string,
  conversationId: string,
  toolCallId: string
): Promise<Array<{id: string, title: string, content: string}>> {
  // Try the new nested path first
  let snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("toolCalls")
    .doc(toolCallId)
    .collection("sections")
    .get();
    
  // If no results in the nested structure, try the flat structure with toolCallId filter
  if (snapshot.empty) {
    console.log(`[DEBUG] No sections found in nested structure, trying flat structure`);
    snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("lawSections")
      .where("toolCallId", "==", toolCallId)
      .get();
  }
    
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "",
      content: data.content || ""
    };
  });
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
}: {
  uid: string;
  conversationId: string;
  toolCallId: string;
  key?: string; // Made optional since it's not used
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

/**
 * Retrieves just the section titles for a conversation.
 * This is useful for displaying a list of available sections
 * without loading the full content of each section.
 * 
 * @param {string} uid - User ID
 * @param {string} conversationId - Conversation ID
 * @param {string} toolCallId - Optional tool call ID to filter sections
 * @returns {Promise<Record<string, string>>} Object with PCS IDs as keys and section titles as values
 */
export async function retrieveSectionTitles(
  uid: string,
  conversationId: string,
  toolCallId?: string
): Promise<Record<string, string>> {
  let snapshot;
  
  if (toolCallId) {
    // If toolCallId is provided, first try the new nested structure
    snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("sections")
      .get();
      
    // If no results in the nested structure, try the flat structure with toolCallId filter
    if (snapshot.empty) {
      snapshot = await adminDb
        .collection("users")
        .doc(uid)
        .collection("conversations")
        .doc(conversationId)
        .collection("lawSections")
        .where("toolCallId", "==", toolCallId)
        .get();
    }
  } else {
    // If no toolCallId provided, just get all lawSections
    snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("lawSections")
      .get();
  }
    
  const titles: Record<string, string> = {};
  snapshot.forEach(doc => {
    titles[doc.id] = doc.data().title || '';
  });
  
  return titles;
}

/**
 * Retrieves a specific section from the law text by its title or identifier.
 * First tries to get it from the structured storage, then falls back to
 * extracting from the full text if needed.
 * 
 * @param {object} params - The parameters for retrieving a section
 * @param {string} params.uid - User ID
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.toolCallId - Tool call ID (optional if using sectionId)
 * @param {string} params.sectionId - Section identifier (P-C-S format)
 * @returns {Promise<string|null>} The extracted section text or null if not found
 */
export async function retrieveSectionText({
  uid,
  conversationId,
  toolCallId,
  sectionId,
}: {
  uid: string;
  conversationId: string;
  toolCallId?: string;
  sectionId: string;
}): Promise<string | null> {
  // If toolCallId is provided and it's a PCS format, try the nested structure first
  if (toolCallId && /^P\d+-C\d+-S\d+$/.test(sectionId)) {
    // Try nested structure first (preferred)
    const sectionDoc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("sections")
      .doc(sectionId)
      .get();
      
    if (sectionDoc.exists) {
      return sectionDoc.data()?.content || null;
    }
  }
  
  // Try the flat structure with PCS format
  if (/^P\d+-C\d+-S\d+$/.test(sectionId)) {
    // First try the direct flat structure
    const sectionDoc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("lawSections")
      .doc(sectionId)
      .get();
      
    if (sectionDoc.exists) {
      return sectionDoc.data()?.content || null;
    }
  }
  
  // If no toolCallId provided or section not found in structured storage, 
  // try to find the most recent tool call
  if (!toolCallId) {
    const toolCallsSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
      
    if (!toolCallsSnapshot.empty) {
      toolCallId = toolCallsSnapshot.docs[0].id;
    }
  }
  
  if (!toolCallId) return null;
  
  // Fall back to original method if not found in structured storage
  // First retrieve the full law text
  const fullText = await retrieveLawText({
    uid,
    conversationId,
    toolCallId,
  });
  
  if (!fullText) return null;
  
  console.log(`Searching for section: "${sectionId}"`);
  
  // Determine search pattern based on sectionId format
  const isPCSFormat = /^P\d+-C\d+-S\d+$/.test(sectionId);
  const isNumberFormat = /^\d+$/.test(sectionId);
  
  let exactPattern = null;
  let titlePattern = null;
  let pcsPattern = null;
  
  if (isPCSFormat) {
    // Store P-C-S format pattern
    pcsPattern = `---- \\[${sectionId}\\] ----(.*?)(?=---- \\[|$)`;
    exactPattern = pcsPattern;
  } else if (isNumberFormat) {
    // Look for section by number
    exactPattern = `Section\\s+${sectionId}:(.*?)(?=\\*\\s*Section|---- \\[P\\d+-C\\d+-S\\d+\\]|$)`;
  } else {
    // Match by section title - be very precise about where the section ends
    const escapedTitle = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (sectionId.toLowerCase().includes('section')) {
      // If title already includes "Section", match it exactly
      titlePattern = `${escapedTitle}(.*?)(?=\\*\\s*Section|---- \\[P\\d+-C\\d+-S\\d+\\]|$)`;
    } else {
      // Otherwise look for "Section: title"
      titlePattern = `Section(?:\\s+\\d+)?:\\s*${escapedTitle}(.*?)(?=\\*\\s*Section|---- \\[P\\d+-C\\d+-S\\d+\\]|$)`;
    }
    exactPattern = titlePattern;
  }

  try {
    // Extract exact section match - very strict boundary
    let sectionContent = null;
    const sectionRegex = new RegExp(exactPattern, 's');
    const match = fullText.match(sectionRegex);
    
    if (match && match[1]) {
      sectionContent = match[1].trim();
      
      // Additional processing to ensure we're not getting extra sections
      // Split into lines
      const lines = sectionContent.split('\n');
      
      // Find the first line index that looks like the start of a new section
      let sectionEndIndex = lines.length;
      for (let i = 0; i < lines.length; i++) {
        if (i > 0 && (
          /^P\d+-C\d+-S\d+/.test(lines[i]) || 
          /^---- \[P\d+-C\d+-S\d+\]/.test(lines[i]) ||
          /^Part:/.test(lines[i]) ||
          /^Section:/.test(lines[i]) && i > 3 // Allow "Section:" in the first few lines (might be part of the content)
        )) {
          sectionEndIndex = i;
          break;
        }
      }
      
      // Only take content up to the next section
      sectionContent = lines.slice(0, sectionEndIndex).join('\n').trim();
      
      // Additional sanity check - if we found P-C-S markers within the content, stop there
      const pcsInContent = sectionContent.match(/P\d+-C\d+-S\d+/g);
      if (pcsInContent && pcsInContent.length > 1) {
        // Multiple P-C-S markers found, likely including other sections
        const firstPCS = pcsInContent[0];
        const parts = sectionContent.split(new RegExp(`P\\d+-C\\d+-S\\d+`, 'g'));
        
        // Keep only the content before the second P-C-S marker
        if (parts.length > 1) {
          sectionContent = firstPCS + parts[1];
        }
      }
      
      return sectionContent;
    }
    
    // If we get here, no match was found
    console.log(`No exact match found for section: "${sectionId}"`);
    return null;
    
  } catch (error) {
    console.error("Regex error extracting section:", error);
    return null;
  }
}