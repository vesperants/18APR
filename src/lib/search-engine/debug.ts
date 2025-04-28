import { adminDb } from "@/services/firebase/admin";
import * as toolCallStore from './toolCallStore'; // Import as namespace to avoid conflicts

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
 * Result of simpleParseSections, including section data and debug info
 */
export interface SimpleParseSectionsResult {
  /** Number of sections parsed */
  count: number;
  /** Parsed section identifiers */
  sectionIds: string[];
  /** Debug information about parsing */
  debug: {
    /** Matched PCS identifiers in the content */
    pcsMatches: string[];
    /** Number of text blocks split for parsing */
    blocksCount: number;
  };
  /** Mapping of section ID to its title and content */
  sections: Record<string, { title: string; content: string }>;
}
/**
 * Simplified section parsing for debugging
 */
export function simpleParseSections(content: string): SimpleParseSectionsResult {
  console.log("[DEBUG-SIMPLE] Content length:", content.length);
  console.log("[DEBUG-SIMPLE] Content preview:", content.substring(0, 200) + "...");
  
  const result: Record<string, { title: string; content: string }> = {};
  
  // Simple regex to match P-C-S patterns and extract sections
  const pcsMatches: string[] = content.match(/\b(P\d+-C\d+-S\d+)\b/g) || [];
  
  // For debugging
  console.log("[DEBUG-SIMPLE] Found PCS matches:", pcsMatches);
  
  // Process the document and extract sections
  const blocks: string[] = content.split(/\n\n(?=P\d+-C\d+-S\d+)/);
  
  // Simplified solution: split by double newlines and look for PCS identifiers
  for (const block of blocks) {
    const pcsMatch = block.match(/\b(P\d+-C\d+-S\d+)\b/);
    if (!pcsMatch) continue;
    
    const pcsId = pcsMatch[1];
    
    // Extract section title
    const titleMatch = block.match(/Section:\s*([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : pcsId;
    
    // Just store the entire block as content for simplicity
    const content = block.trim();
    
    // Add to result with proper type
    result[pcsId] = { title, content };
  }
  
  console.log("[DEBUG-SIMPLE] Extracted section count:", Object.keys(result).length);
  
  // Prepare structured result
  const sectionIds = Object.keys(result);
  const count = sectionIds.length;
  const debugInfo = {
    pcsMatches,
    blocksCount: blocks.length,
  };
  
  return {
    count,
    sectionIds,
    debug: debugInfo,
    sections: result,
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

/**
 * Test function to demonstrate how content extraction works
 */
export function testContentExtraction() {
  // Example input text with Nepali legal content
  const exampleText = `
P4-C6-S325 Part: सम्पत्ति सम्बन्धी कानून Chapter: गुठी सम्बन्धी व्यवस्था Section: गुठी सञ्चालकको अयोग्यता Content: देहायको व्यक्ति गुठी सञ्चालक हुन योग्य हुने छैन :- Clause (क): करार गर्न अयोग्य भएको, Clause (ख): आफ्नो जिम्मामा रहेको सम्पत्ति हिनामिना गरेको, Clause (ग): भ्रष्टाचारको कसूरमा अदालतबाट दोषी ठहरिएको, Clause (घ): नैतिक पतन देखिने फौजदारी कसूरमा सजाय पाएको, Clause (ङ): गुठी सञ्चालन भएको सम्पत्तिको आफू मात्र हितग्राही भएको ।

P4-C6-S336 Part: सम्पत्ति सम्बन्धी कानून Chapter: गुठी सम्बन्धी व्यवस्था Section: गुठीका लगत र अभिलेख Content: गुठीका लगत र अभिलेखहरू देहाय बमोजिम हुनेछन्:- Clause (क): गुठी संस्थान ऐन, २०३३ बमोजिम तयार गरिएको गुठीको श्रेस्ता, Clause (ख): गुठी रैतान नम्बरीमा परिणत भएका जग्गाको अभिलेख, Clause (ग): पहिलेदेखिको गुठीको रूपमा संरक्षण गरिएको गुठीको अभिलेख, Clause (घ): विभिन्न किसिमले गुठी संस्थानलाई प्राप्त भएका गुठीहरू, Clause (ङ): संस्थापित नयाँ गुठीको अभिलेख ।
  `;

  // Parse the content using the imported function from toolCallStore
  const parsedSections = toolCallStore.parseContentSections(exampleText);

  // Display the results
  console.log('Parsed Sections:');
  for (const [sectionId, section] of Object.entries(parsedSections)) {
    console.log(`\n---------- Section ID: ${sectionId} ----------`);
    console.log(`Title: ${section.title}`);
    
    // Show structural metadata
    console.log('\nStructural Metadata:');
    const metadata = {
      partNumber: section.partNumber,
      partTitle: section.partTitle,
      chapterNumber: section.chapterNumber,
      chapterTitle: section.chapterTitle,
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
    };
    
    Object.entries(metadata).forEach(([key, value]) => {
      if (value) console.log(`  ${key}: ${value}`);
    });
    
    // Show node titles (should only contain structural elements now)
    console.log('\nNode Titles (Only Structure):');
    if (section.nodeTitles) {
      Object.entries(section.nodeTitles).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    // Show content by itself (should not have metadata in it)
    console.log('\nContent (Actual Legal Text):');
    console.log(`  ${section.content}`);
    
    // Check if content properly contains clauses and other content elements
    const hasClauseContent = section.content.includes('Clause');
    console.log(`\nContent contains clauses: ${hasClauseContent ? 'YES ✓' : 'NO ✗'}`);
    
    console.log('-------------------------------------------');
  }

  return parsedSections;
} 