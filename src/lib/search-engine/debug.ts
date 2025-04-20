import { adminDb } from "@/services/firebase/admin";

/**
 * Checks if lawSections collection exists and returns stats about its contents
 */
export async function getLawSectionsStats(uid: string, conversationId: string) {
  try {
    // Check if the lawSections collection exists
    const sectionsSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("lawSections")
      .get();
    
    const stats = {
      exists: true,
      count: sectionsSnapshot.size,
      sectionIds: sectionsSnapshot.docs.map(doc => doc.id),
      titles: Object.fromEntries(sectionsSnapshot.docs.map(doc => [doc.id, doc.data().title])),
    };
    
    return stats;
  } catch (error) {
    console.error("Error checking lawSections collection:", error);
    return {
      exists: false,
      count: 0,
      sectionIds: [],
      titles: {},
      error: String(error)
    };
  }
}

/**
 * Simplest possible section parser using string splitting
 */
export function simpleParseSections(content: string) {
  console.log("[DEBUG-SIMPLE] Content length:", content.length);
  console.log("[DEBUG-SIMPLE] Content preview:", content.substring(0, 200) + "...");
  
  // Log pattern occurrences
  const pcsCount = (content.match(/P\d+-C\d+-S\d+/g) || []).length;
  const sectionHeaderCount = (content.match(/Section:/g) || []).length;
  const markerCount = (content.match(/---- \[/g) || []).length;
  
  console.log(`[DEBUG-SIMPLE] Pattern counts: PCS=${pcsCount}, Section=${sectionHeaderCount}, Markers=${markerCount}`);
  
  // First try marker-based splitting
  const sections: Record<string, { title: string, content: string }> = {};
  let sectionIds: string[] = [];
  
  // Regex approach with capture groups to get sections
  const markerPattern = /---- \[(P\d+-C\d+-S\d+)\] ----([\s\S]*?)(?=---- \[|$)/g;
  let match;
  while ((match = markerPattern.exec(content)) !== null) {
    const pcsId = match[1];
    const sectionContent = match[2].trim();
    
    // Extract title
    const titleMatch = sectionContent.match(/Section: ([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    console.log(`[DEBUG-SIMPLE] Found marker section ${pcsId} with title: ${title}`);
    
    sections[pcsId] = { title, content: sectionContent };
    sectionIds.push(pcsId);
  }
  
  // Fallback: If no marker sections found, try direct PCS pattern
  if (sectionIds.length === 0 && pcsCount > 0) {
    console.log("[DEBUG-SIMPLE] No marker sections found, trying direct PCS pattern");
    const directPattern = /(P\d+-C\d+-S\d+)([\s\S]*?)(?=P\d+-C\d+-S\d+|$)/g;
    while ((match = directPattern.exec(content)) !== null) {
      const pcsId = match[1];
      const sectionContent = match[2].trim();
      
      // Extract title
      const titleMatch = sectionContent.match(/Section: ([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      console.log(`[DEBUG-SIMPLE] Found direct section ${pcsId} with title: ${title}`);
      
      sections[pcsId] = { title, content: sectionContent };
      sectionIds.push(pcsId);
    }
  }
  
  // Fallback for manual splitting
  if (sectionIds.length === 0 && markerCount > 0) {
    console.log("[DEBUG-SIMPLE] Trying manual split by markers");
    
    // Manual split by markers
    const parts = content.split(/---- \[(P\d+-C\d+-S\d+)\] ----/);
    
    // Skip the first part (it's before the first marker)
    for (let i = 1; i < parts.length; i += 2) {
      if (i+1 >= parts.length) break;
      
      const pcsId = parts[i];
      const sectionContent = parts[i+1];
      
      // Extract title
      const titleMatch = sectionContent?.match(/Section: ([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      sections[pcsId] = {
        title,
        content: sectionContent?.trim() || ''
      };
      sectionIds.push(pcsId);
    }
  }
  
  return {
    sections,
    count: Object.keys(sections).length,
    sectionIds: sectionIds,
    titles: Object.fromEntries(Object.entries(sections).map(([id, data]) => [id, (data as { title: string }).title])),
    debug: {
      pcsCount,
      sectionHeaderCount,
      markerCount,
      contentPreview: content.substring(0, 300)
    }
  };
}

/**
 * Parses the content of a legal search result into structured sections
 * (This is a copy of the function in toolCallStore.ts for testing)
 * 
 * @param content The full text content with multiple sections
 * @returns An object with PCS identifiers as keys and section data as values
 */
export function parseContentSections(content: string) {
  console.log("[DEBUG] Starting section parsing for content length:", content.length);
  console.log("[DEBUG] First 100 chars:", content.substring(0, 100));
  
  const sections: Record<string, { title: string, content: string }> = {};
  const sectionPattern = /---- \[(P\d+-C\d+-S\d+)\] ----([^-]*?)(?=---- \[|$)/g;
  
  console.log("[DEBUG] Using regex pattern:", sectionPattern.toString());
  
  let match;
  while ((match = sectionPattern.exec(content)) !== null) {
    const pcsId = match[1];
    const sectionContent = match[2].trim();
    
    // Extract section title
    const titleMatch = sectionContent.match(/Section: ([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    console.log(`[DEBUG] Found section ${pcsId} with title: ${title}`);
    console.log(`[DEBUG] Section content starts with: ${sectionContent.substring(0, 50)}...`);
    
    sections[pcsId] = {
      title: title,
      content: sectionContent
    };
  }
  
  console.log(`[DEBUG] Parsed ${Object.keys(sections).length} sections`);
  return sections;
}

/**
 * Tests section parsing with the provided content
 */
export function testParseSections(content: string) {
  console.log("[TEST-PARSE] Using simpler parsing method");
  // Use the simpler method for testing
  return simpleParseSections(content);
} 