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

/**
 * Retrieves a specific section from the law text by its title or identifier.
 * First retrieves the full law text, then extracts just the requested section.
 * 
 * @param {object} params - The parameters for retrieving a section
 * @param {string} params.uid - User ID
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.toolCallId - Tool call ID
 * @param {string} params.sectionId - Section identifier (section title, P-C-S format, or section number)
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
  toolCallId: string;
  sectionId: string;
}): Promise<string | null> {
  // First retrieve the full law text
  const fullText = await retrieveLawText({
    uid,
    conversationId,
    toolCallId,
    key: '',  // Key is not used in retrieval
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