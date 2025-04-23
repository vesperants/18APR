import { adminDb } from '@/services/firebase/admin';
import type { CollectionReference, DocumentData } from '@google-cloud/firestore';
import type { DocumentStructureInfo } from "./types";

// Define batch size limit for Firestore batch operations
const BATCH_SIZE_LIMIT = 500;

/**
 * Detects the document structure from section IDs
 * This is a duplicate of the function in toolCallStore.ts to avoid circular dependencies
 */
function detectDocumentStructure(sectionIds: string[]): DocumentStructureInfo {
  // Check for P-C-S format
  const pcsCount = sectionIds.filter(id => /^P\d+-C\d+-S\d+$/.test(id)).length;
  
  // Check for P-S format
  const psCount = sectionIds.filter(id => /^P\d+-S\d+$/.test(id)).length;
  
  // Check for C-S format
  const csCount = sectionIds.filter(id => /^C\d+-S\d+$/.test(id)).length;
  
  // Check for Article format
  const artCount = sectionIds.filter(id => /^ART\d+$/.test(id)).length;
  
  // Check for Section-only format
  const secCount = sectionIds.filter(id => /^S\d+$/.test(id)).length;
  
  // Find the dominant format
  const formatCounts = {
    pcs: pcsCount,
    ps: psCount,
    cs: csCount,
    article: artCount,
    section: secCount
  };
  
  // Determine most common format
  let dominantFormat = 'unknown';
  let maxCount = 0;
  
  for (const [format, count] of Object.entries(formatCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantFormat = format;
    }
  }
  
  // Create structure info based on the dominant format
  if (dominantFormat === 'pcs' && pcsCount > 0) {
    return { 
      format: 'pcs', 
      levels: ['part', 'chapter', 'section'],
      levelSeparator: '-',
      levelPrefixes: { part: 'P', chapter: 'C', section: 'S' }
    };
  } else if (dominantFormat === 'ps' && psCount > 0) {
    return { 
      format: 'ps', 
      levels: ['part', 'section'],
      levelSeparator: '-',
      levelPrefixes: { part: 'P', section: 'S' }
    };
  } else if (dominantFormat === 'cs' && csCount > 0) {
    return { 
      format: 'cs', 
      levels: ['chapter', 'section'],
      levelSeparator: '-',
      levelPrefixes: { chapter: 'C', section: 'S' }
    };
  } else if (dominantFormat === 'article' && artCount > 0) {
    return { 
      format: 'article', 
      levels: ['article'],
      levelSeparator: '-',
      levelPrefixes: { article: 'ART' }
    };
  } else if (dominantFormat === 'section' && secCount > 0) {
    return { 
      format: 'section', 
      levels: ['section'],
      levelSeparator: '-',
      levelPrefixes: { section: 'S' }
    };
  }
  
  // If no known pattern is dominant, try inferring from the first ID
  if (sectionIds.length > 0) {
    return inferDocumentStructure(sectionIds[0]);
  }
  
  // Default
  return { 
    format: 'unknown', 
    levels: ['section'],
    levelSeparator: '-',
    levelPrefixes: { section: 'S' }
  };
}

/**
 * Infers document structure from a section ID by analyzing patterns
 */
function inferDocumentStructure(sectionId: string): DocumentStructureInfo {
  // Determine the separator used (if any)
  const separator = sectionId.includes('-') ? '-' : 
                   sectionId.includes('.') ? '.' :
                   sectionId.includes('/') ? '/' : null;
  
  if (!separator) {
    // Single level ID (e.g., S12, ART5)
    const match = sectionId.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      const [, prefix] = match;
      const levelType = inferLevelTypeFromPrefix(prefix);
      
      return {
        format: levelType,
        levels: [levelType],
        levelSeparator: '-', // Default separator for consistency
        levelPrefixes: { [levelType]: prefix }
      };
    }
    
    // Unrecognized format, use default
    return { 
      format: 'unknown', 
      levels: ['section'],
      levelSeparator: '-',
      levelPrefixes: { section: 'S' }
    };
  }
  
  // Multi-level ID with separator (e.g., P1-C2-S3, T1.CH2.SEC3)
  const parts = sectionId.split(separator);
  const levels: string[] = [];
  const prefixes: Record<string, string> = {};
  
  for (const part of parts) {
    const match = part.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      const [, prefix] = match;
      const levelType = inferLevelTypeFromPrefix(prefix);
      
      levels.push(levelType);
      prefixes[levelType] = prefix;
    }
  }
  
  if (levels.length > 0) {
    return {
      format: levels.join('-'),
      levels,
      levelSeparator: separator,
      levelPrefixes: prefixes
    };
  }
  
  // Fallback for unrecognized formats
  return { 
    format: 'unknown', 
    levels: ['section'],
    levelSeparator: '-',
    levelPrefixes: { section: 'S' }
  };
}

/**
 * Infers the level type based on common prefix abbreviations
 */
function inferLevelTypeFromPrefix(prefix: string): string {
  const upperPrefix = prefix.toUpperCase();
  
  const prefixMap: Record<string, string> = {
    'P': 'part',
    'PT': 'part',
    'C': 'chapter',
    'CH': 'chapter',
    'S': 'section',
    'SEC': 'section',
    'A': 'article',
    'ART': 'article',
    'T': 'title',
    'TIT': 'title',
    'D': 'division',
    'SUB': 'subdivision',
    'PAR': 'paragraph'
  };
  
  return prefixMap[upperPrefix] || 'section';
}

/**
 * Parses a section ID into its hierarchical components based on document structure
 */
function parseHierarchicalId(sectionId: string, structure: DocumentStructureInfo): string[] {
  const { levelSeparator, levelPrefixes } = structure;
  
  // Split the ID by the separator
  if (sectionId.includes(levelSeparator)) {
    return sectionId.split(levelSeparator);
  }
  
  // Handle single-level IDs
  // Try to extract the prefix and number
  for (const [, prefix] of Object.entries(levelPrefixes)) {
    if (sectionId.startsWith(prefix)) {
      return [sectionId];
    }
  }
  
  // Default: return the ID as a single component
  return [sectionId];
}

/**
 * Store section nodes - simplified to only store leaf nodes
 * Creates a flat structure directly under document files with just the innermost children (leaf nodes)
 * Now includes content directly with each node instead of using content hash references
 */
export async function storeHierarchicalNodes(
  nodesCollection: CollectionReference<DocumentData>, // the Firestore collection ref for nodes
  sectionIds: string[],
  sectionsMap: Record<string, {
    title: string,
    content: string,
    documentId?: string,
    documentTitle?: string,
    partNumber?: string,
    chapterNumber?: string,
    sectionNumber?: string,
    partTitle?: string,
    chapterTitle?: string,
    sectionTitle?: string,
    nodeTitles?: Record<string, string>
  }>
): Promise<void> {
  let batchOp = adminDb.batch();
  let batchCount = 0;
  
  // Get document structure to identify hierarchy levels
  const documentStructure = detectDocumentStructure(sectionIds);
  
  // Store the leaf nodes with all their metadata
  for (const sectionId of sectionIds) {
    const sectionData = sectionsMap[sectionId];
    if (!sectionData) continue;
    
    // Parse the section ID to extract hierarchy components
    const components = parseHierarchicalId(sectionId, documentStructure);
    
    // Create metadata object - only include structural information, not content
    const metadata: Record<string, unknown> = {};
    
    // Add basic document information
    if (sectionData.documentId) metadata.documentId = sectionData.documentId;
    if (sectionData.documentTitle) metadata.documentTitle = sectionData.documentTitle;
    
    // Add standard hierarchical components without duplication
    if (sectionData.partNumber) {
      metadata.partNumber = sectionData.partNumber;
    }
    
    if (sectionData.chapterNumber) {
      metadata.chapterNumber = sectionData.chapterNumber;
    }
    
    if (sectionData.sectionNumber) {
      metadata.sectionNumber = sectionData.sectionNumber;
    }
    
    // Add titles for hierarchical nodes - this is important metadata
    if (sectionData.partTitle) metadata.partTitle = sectionData.partTitle;
    if (sectionData.chapterTitle) metadata.chapterTitle = sectionData.chapterTitle;
    if (sectionData.sectionTitle) metadata.sectionTitle = sectionData.sectionTitle;
    
    // Only add node titles for structure elements, not content elements
    if (sectionData.nodeTitles) {
      // Filter out content-related keys (Clause content)
      Object.entries(sectionData.nodeTitles).forEach(([key, value]) => {
        // Only add structural titles, skip content items like clauses
        if (key.startsWith('partTitle') || 
            key.startsWith('chapterTitle') || 
            key.startsWith('sectionTitle') || 
            key.startsWith('subsectionTitle') ||
            key.startsWith('articleTitle')) {
          metadata[key] = value;
        }
      });
    }
    
    // Create the node data for the section
    const nodeData = {
      nodeId: sectionId,
      nodeType: 'section',
      nodeTitle: sectionData.title || sectionId,
      content: sectionData.content, // Store just the actual content
      createdAt: new Date(),
      hierarchyPath: components, // Store the full path as an array
      metadata
    };
    
    // Store the node
    const nodeRef = nodesCollection.doc(sectionId);
    batchOp.set(nodeRef, nodeData);
    batchCount++;
    
    // Commit batch if reaching limit
    if (batchCount >= BATCH_SIZE_LIMIT) {
      await batchOp.commit();
      batchOp = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Commit any remaining batch operations
  if (batchCount > 0) {
    await batchOp.commit();
  }
}

export default storeHierarchicalNodes; 