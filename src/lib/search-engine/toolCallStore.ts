// src/lib/search-engine/toolCallStore.ts
// Use centralized Firebase Admin SDK initialization
import { adminDb } from '@/services/firebase/admin';
import type { HierarchyNode, DocumentStructureInfo } from "./types";
import storeHierarchicalNodes from './storeHierarchicalNodes';

// Define batch size limit for Firestore batch operations
const BATCH_SIZE_LIMIT = 500;

/**
 * Parses the content of a legal search result into structured sections
 * based on various hierarchical identifiers (P-C-S, C-S, etc.).
 * 
 * @param content The full text content with multiple sections
 * @returns An object with section identifiers as keys and section data as values
 */
export function parseContentSections(content: string): Record<string, { 
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
}> {
  console.log("[DEBUG] Starting section parsing for content:", content.substring(0, 100) + "...");
  const sections: Record<string, {
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
  }> = {};
  
  // Try to extract document information from the first few lines
  let documentId: string | undefined = undefined;
  let documentTitle: string | undefined = undefined;
  
  // First check for a document name marker pattern
  const docNameMarker = content.match(/^Document:\s*([^\n]+)/i);
  if (docNameMarker) {
    documentId = docNameMarker[1].trim();
    documentTitle = docNameMarker[1].trim();
    console.log(`[DEBUG] Found document name marker: "${documentId}"`);
  }
  
  // If not found, try other patterns
  if (!documentId) {
    const docMatch = content.match(/Document(?:\s+ID)?:\s*([A-Za-z0-9_\-]+)/i);
    if (docMatch) {
      documentId = docMatch[1].trim();
      console.log(`[DEBUG] Found document ID: "${documentId}"`);
    } else {
      // Try to find statute or code references
      const statuteMatch = content.match(/(?:from|in)\s+the\s+([A-Za-z\s]+(?:Code|Act|Statute|Law))/i);
      if (statuteMatch) {
        documentId = statuteMatch[1].trim();
        documentTitle = statuteMatch[1].trim();
        console.log(`[DEBUG] Found statute reference: "${documentId}"`);
      }
    }
  }
  
  // If still no document ID, try to extract from the first line
  if (!documentId) {
    const firstLine = content.split('\n')[0].trim();
    if (firstLine && firstLine.length > 5 && firstLine.length < 100) {
      documentId = firstLine;
      documentTitle = firstLine;
      console.log(`[DEBUG] Using first line as document name: "${documentId}"`);
    }
  }
  
  // Step 1: Detect the document format (P-C-S, C-S, etc.)
  const formatPatterns = {
    pcs: /P\d+-C\d+-S\d+/g,
    cs: /C\d+-S\d+/g,
    ps: /P\d+-S\d+/g,
    article: /ART\d+/g,
    section: /S\d+/g
  };
  
  let dominantFormat = 'unknown';
  let sectionMarkers: RegExpMatchArray | null = null;
  let maxMatches = 0;
  
  // Find which format pattern has the most matches
  for (const [format, pattern] of Object.entries(formatPatterns)) {
    const matches = content.match(pattern);
    const count = matches ? matches.length : 0;
    
    if (count > maxMatches) {
      maxMatches = count;
      dominantFormat = format;
      sectionMarkers = matches;
    }
  }
  
  console.log(`[DEBUG] Detected dominant format: ${dominantFormat} with ${maxMatches} matches`);
  
  // If we couldn't find any section markers, return empty
  if (!sectionMarkers || maxMatches === 0) {
    console.log("[DEBUG] No section markers found in content");
    return sections;
  }
  
  // Step 2: Extract each section based on the detected format
  // Get unique section IDs (in case there are duplicates)
  const uniqueSectionIds = Array.from(new Set(sectionMarkers));
  console.log(`[DEBUG] Found ${uniqueSectionIds.length} unique section IDs`);
  
  // Step 3: Extract the content for each section
  // For each section ID, find its position and the position of the next section ID
  const positions = [];
  
  for (const sectionId of uniqueSectionIds) {
    // Find all occurrences of this section ID in the content
    const startPos = content.indexOf(sectionId);
    
    // There might be multiple occurrences of the same ID, so only use the first
    if (startPos !== -1) {
      positions.push({
        id: sectionId,
        start: startPos
      });
    }
  }
  
  // Sort positions by their starting position in the document
  positions.sort((a, b) => a.start - b.start);
  
  // Extract each section's content
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    // The end is either the start of the next section or the end of the content
    const next = i < positions.length - 1 ? positions[i + 1] : null;
    
    // Calculate the end position of the current section
    const endPos = next ? next.start : content.length;
    
    // Extract the section content
    const sectionContent = content.substring(current.start, endPos).trim();
    
    // Process the section content to extract metadata
    const lines = sectionContent.split('\n');
    const sectionId = current.id;
    
    // Extract title information
    const nodeTitles: Record<string, string> = {};
    
    // Look for Chapter: and Section: in the first few lines
    for (let j = 0; j < Math.min(10, lines.length); j++) {
      const line = lines[j];
      
      if (line.startsWith('Chapter:')) {
        nodeTitles['chapterTitle'] = line.substring('Chapter:'.length).trim();
      } else if (line.match(/^Chapter:\s/)) {
        nodeTitles['chapterTitle'] = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('Section:')) {
        nodeTitles['sectionTitle'] = line.substring('Section:'.length).trim();
      } else if (line.match(/^Section:\s/)) {
        nodeTitles['sectionTitle'] = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('Part:')) {
        nodeTitles['partTitle'] = line.substring('Part:'.length).trim();
      } else if (line.match(/^Part:\s/)) {
        nodeTitles['partTitle'] = line.substring(line.indexOf(':') + 1).trim();
      }
    }
    
    // Extract part/chapter/section numbers based on format
    let partNumber: string | undefined;
    let chapterNumber: string | undefined;
    let sectionNumber: string | undefined;
    
    if (dominantFormat === 'pcs') {
      const match = sectionId.match(/P(\d+)-C(\d+)-S(\d+)/);
      if (match) {
        partNumber = match[1];
        chapterNumber = match[2];
        sectionNumber = match[3];
      }
    } else if (dominantFormat === 'cs') {
      const match = sectionId.match(/C(\d+)-S(\d+)/);
      if (match) {
        chapterNumber = match[1];
        sectionNumber = match[2];
      }
    } else if (dominantFormat === 'ps') {
      const match = sectionId.match(/P(\d+)-S(\d+)/);
      if (match) {
        partNumber = match[1];
        sectionNumber = match[2];
      }
    } else if (dominantFormat === 'article') {
      const match = sectionId.match(/ART(\d+)/);
      if (match) {
        sectionNumber = match[1];
      }
    } else if (dominantFormat === 'section') {
      const match = sectionId.match(/S(\d+)/);
      if (match) {
        sectionNumber = match[1];
      }
    }
    
    // Set the section title
    const title = nodeTitles['sectionTitle'] || 
                nodeTitles['articleTitle'] || 
                sectionId;
    
    // Store the section
    sections[sectionId] = {
      title,
      content: sectionContent,
      documentId,
      documentTitle,
      partNumber,
      chapterNumber,
      sectionNumber,
      partTitle: nodeTitles['partTitle'],
      chapterTitle: nodeTitles['chapterTitle'],
      sectionTitle: nodeTitles['sectionTitle'],
      nodeTitles
    };
    
    console.log(`[DEBUG] Extracted section ${sectionId} with title: ${title}`);
  }
  
  console.log(`[DEBUG] Parsed ${Object.keys(sections).length} sections`);
  return sections;
}

/**
 * Enhanced function to detect document structure from section IDs
 * Now supports more formats and arbitrary hierarchical structures
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
 * Stores the extracted / processed law text and bumps the call counters.
 * Improved version with optimized storage:
 * 1. Stores content directly with each node
 * 2. Efficiently supports arbitrary hierarchical structures
 * 3. Focuses on leaf nodes for simplicity
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
}): Promise<ReturnType<typeof parseContentSections>> {
  console.log(`[DEBUG] saveToolCallWithCounters called for toolCallId: ${toolCallId}`);
  
  let finalSectionsMap: ReturnType<typeof parseContentSections> = {};
  
  const docRef = adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("toolCalls")
    .doc(toolCallId);

  // Create the initial document with metadata but WITHOUT the full content
  await docRef.set({
    key,
    contentSummary: {
      length: content.length,
      preview: content.substring(0, 100) + '...' // Optional: store just a preview
    },
    createdAt: new Date(),
    tokensUsed,
    type,
    hasExtractedSections: false, // Will be updated after extraction
  });
  
  console.log(`[DEBUG] Tool call metadata saved to toolCalls/${toolCallId} without full content`);

  // Defensive: ensure content is always a string
  if (typeof content !== 'string') {
    console.error('[saveToolCallWithCounters] Content is not a string:', content);
    content = '';
  }

  // Parse and store structured sections
  try {
    console.log(`[DEBUG] Starting section parsing for content length: ${content.length}`);
    const sectionsMap = parseContentSections(content);
    finalSectionsMap = sectionsMap;
    
    // Store sections in a flexible hierarchical format
    let batchOp = adminDb.batch();
    let batchCount = 0;
    
    // Group sections by documentId/filename
    const documentMap: Record<string, {
      documentId: string;
      documentTitle: string;
      sectionIds: string[];
    }> = {};
    
    // Group sections by document
    for (const [sectionId, sectionData] of Object.entries(sectionsMap)) {
      // Use clean documentId as the key, defaulting to 'unknown_document' if missing
      const documentId = sectionData.documentId || 'unknown_document';
      
      if (!documentMap[documentId]) {
        documentMap[documentId] = {
          documentId,
          documentTitle: sectionData.documentTitle || documentId,
          sectionIds: []
        };
      }
      
      documentMap[documentId].sectionIds.push(sectionId);
    }
    
    // Detect document structure from section IDs
    const allSectionIds = Object.keys(sectionsMap);
    const documentStructure = detectDocumentStructure(allSectionIds);
    
    // Set up Firestore path for the hierarchical data
    const hierarchyRef = docRef.collection("hierarchy");
    
    // Store document-level data
    for (const [documentId, docData] of Object.entries(documentMap)) {
      const docRef = hierarchyRef.doc(documentId);
      
      batchOp.set(docRef, {
        documentId: docData.documentId,
        documentTitle: docData.documentTitle,
        createdAt: new Date(),
        sectionCount: docData.sectionIds.length,
        documentStructure // Store structure information
      });
      
      batchCount++;
      if (batchCount >= BATCH_SIZE_LIMIT) {
        await batchOp.commit();
        batchOp = adminDb.batch();
        batchCount = 0;
      }
      
      // Now build and store the hierarchy based on the detected document structure
      await storeHierarchicalNodes(
        docRef.collection("nodes"),
        docData.sectionIds,
        sectionsMap
      );
    }
    
    // Commit remaining batch operations
    if (batchCount > 0) {
      await batchOp.commit();
    }
    
    // Mark the tool call as having extracted sections
    await docRef.update({
      hasExtractedSections: true,
      sectionCount: Object.keys(sectionsMap).length,
      documentCount: Object.keys(documentMap).length,
      documentStructure: documentStructure // Include structure info
    });
    
    console.log(`[DEBUG] Tool call sections saved with optimized storage`);
  } catch (err) {
    console.error(`[saveToolCallWithCounters] Error during section storage:`, err);
    await docRef.update({
      error: (err as Error)?.message || "Unknown error",
      errorTimestamp: new Date()
    });
  }
  
  return finalSectionsMap;
}

/**
 * Retrieves the content of a specific node in the hierarchy
 */
export async function retrieveNodeContent({
  uid,
  conversationId,
  toolCallId,
  documentId,
  nodeId
}: {
  uid: string;
  conversationId: string;
  toolCallId: string;
  documentId: string;
  nodeId: string;
}): Promise<{
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  content?: string;
  children?: string[];
  parentId?: string;
  metadata?: Record<string, unknown>;
} | null> {
  try {
    console.log(`[DEBUG] Retrieving node content for ${nodeId} in document ${documentId}`);
    
    const nodeRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("hierarchy")
      .doc(documentId)
      .collection("nodes")
      .doc(nodeId);
    
    const nodeDoc = await nodeRef.get();
    
    if (!nodeDoc.exists) {
      console.log(`[DEBUG] Node ${nodeId} not found`);
      return null;
    }
    
    const nodeData = nodeDoc.data();
    if (!nodeData) {
      console.log(`[DEBUG] Node ${nodeId} has no data`);
      return null;
    }
    
    return {
      nodeId: nodeData.nodeId,
      nodeTitle: nodeData.nodeTitle,
      nodeType: nodeData.nodeType,
      content: nodeData.content,
      children: nodeData.children,
      parentId: nodeData.parentId,
      metadata: nodeData.metadata
    };
  } catch (error) {
    console.error(`[DEBUG] Error retrieving node content:`, error);
    return null;
  }
}

/**
 * Recursively builds a complete subtree from a node ID
 */
export async function buildNodeSubtree({
  uid,
  conversationId,
  toolCallId,
  documentId,
  nodeId,
  includeContent = false
}: {
  uid: string;
  conversationId: string;
  toolCallId: string;
  documentId: string;
  nodeId: string;
  includeContent?: boolean;
}): Promise<HierarchyNode | null> {
  try {
    // Get the node data
    const nodeData = await retrieveNodeContent({
      uid,
      conversationId,
      toolCallId,
      documentId,
      nodeId
    });
    
    if (!nodeData) {
      return null;
    }
    
    // Create the node
    const node: HierarchyNode = {
      nodeId: nodeData.nodeId,
      nodeType: nodeData.nodeType,
      nodeTitle: nodeData.nodeTitle,
      metadata: nodeData.metadata
    };
    
    // Only include content if requested (to reduce payload size)
    if (includeContent && nodeData.content) {
      node.content = nodeData.content;
    }
    
    // Recursively build children if any
    if (nodeData.children && nodeData.children.length > 0) {
      node.children = [];
      
      for (const childId of nodeData.children) {
        const childNode = await buildNodeSubtree({
          uid,
          conversationId,
          toolCallId,
          documentId,
          nodeId: childId,
          includeContent
        });
        
        if (childNode) {
          node.children.push(childNode);
        }
      }
    }
    
    return node;
  } catch (error) {
    console.error(`[DEBUG] Error building node subtree:`, error);
    return null;
  }
}

/**
 * Retrieves all sections with their content for a given toolCallId, optimized for the frontend
 */
export async function retrieveAllNodeContents({
  _uid,
  _conversationId,
  toolCallId
}: {
  _uid: string;
  _conversationId: string;
  toolCallId: string;
}): Promise<Record<string, Record<string, {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  content?: string;
  children?: string[];
  parentId?: string;
  metadata?: Record<string, unknown>;
}>>> {
  try {
    console.log(`[DEBUG] Retrieving all node contents for toolCallId: ${toolCallId}`);
    
    // Get all documents in the hierarchy
    const hierarchyRef = adminDb
      .collection("users")
      .doc(_uid)
      .collection("conversations")
      .doc(_conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("hierarchy");
    
    const docsSnapshot = await hierarchyRef.get();
    const result: Record<string, Record<string, {
      nodeId: string;
      nodeTitle: string;
      nodeType: string;
      content?: string;
      children?: string[];
      parentId?: string;
      metadata?: Record<string, unknown>;
    }>> = {};
    
    // For each document, get all its nodes
    for (const docDoc of docsSnapshot.docs) {
      const documentId = docDoc.id;
      const documentData = docDoc.data();
      
      console.log(`[DEBUG] Processing document: ${documentId}, title: ${documentData.documentTitle}`);
      
      const nodesRef = hierarchyRef.doc(documentId).collection("nodes");
      const nodesSnapshot = await nodesRef.get();
      
      result[documentId] = {};
      
      // Store all nodes in the result
      for (const nodeDoc of nodesSnapshot.docs) {
        const nodeId = nodeDoc.id;
        const nodeData = nodeDoc.data();
        
        result[documentId][nodeId] = {
          nodeId: nodeData.nodeId,
          nodeTitle: nodeData.nodeTitle,
          nodeType: nodeData.nodeType,
          content: nodeData.content,
          children: nodeData.children,
          parentId: nodeData.parentId,
          metadata: nodeData.metadata as Record<string, unknown>
        };
      }
    }
    
    console.log(`[DEBUG] Retrieved node contents for ${Object.keys(result).length} documents`);
    
    return result;
  } catch (error) {
    console.error(`[DEBUG] Error retrieving all node contents:`, error);
    return {};
  }
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
    
  return Promise.all(snapshot.docs.map(async doc => {
    const data = doc.data();
    
    // Calculate sectionsCount from files if we don't store it directly
    let sectionsCount = data.sectionsCount || 0;
    
    // If no sectionsCount but has files metadata, compute from there
    if (!sectionsCount && data.files && Array.isArray(data.files)) {
      sectionsCount = data.files.reduce((sum, file) => sum + (file.sectionsCount || 0), 0);
    }
    
    return {
      id: doc.id,
      key: data.key || "",
      createdAt: data.createdAt?.toDate() || new Date(),
      sectionsCount
    };
  }));
}

/**
 * Utility function to clean up any existing nodes that might have content data in metadata
 * This can be run as a one-time cleanup operation
 */
export async function cleanupContentFromMetadata(
  uid: string,
  conversationId: string,
  toolCallId: string
): Promise<{ 
  success: boolean; 
  documentsProcessed: number; 
  nodesProcessed: number;
  nodesUpdated: number;
}> {
  console.log(`[DEBUG] Starting metadata cleanup for toolCallId: ${toolCallId}`);
  
  const result = {
    success: false,
    documentsProcessed: 0,
    nodesProcessed: 0,
    nodesUpdated: 0
  };
  
  try {
    // Get the hierarchy documents
    const hierarchyRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("hierarchy");
    
    const docs = await hierarchyRef.get();
    result.documentsProcessed = docs.size;
    
    // Process each document
    for (const doc of docs.docs) {
      const documentId = doc.id;
      const nodesRef = hierarchyRef.doc(documentId).collection("nodes");
      const nodes = await nodesRef.get();
      
      console.log(`[DEBUG] Processing document ${documentId} with ${nodes.size} nodes`);
      result.nodesProcessed += nodes.size;
      
      // Create a batch for updates
      let batchOp = adminDb.batch();
      let batchCount = 0;
      let updatedNodes = 0;
      
      for (const nodeDoc of nodes.docs) {
        const nodeData = nodeDoc.data();
        if (!nodeData.metadata) continue;
        
        // Create a cleaned metadata object
        const cleanedMetadata: Record<string, unknown> = {};
        const metadataToKeep = [
          'documentId', 'documentTitle',
          'partNumber', 'partTitle',
          'chapterNumber', 'chapterTitle',
          'sectionNumber', 'sectionTitle'
        ];
        
        // Keep only structural metadata
        for (const key of metadataToKeep) {
          if (nodeData.metadata[key] !== undefined) {
            cleanedMetadata[key] = nodeData.metadata[key];
          }
        }
        
        // Check if we need to update this node
        const needsUpdate = Object.keys(cleanedMetadata).length !== Object.keys(nodeData.metadata).length;
        
        if (needsUpdate) {
          // Update the node with cleaned metadata
          batchOp.update(nodeDoc.ref, { metadata: cleanedMetadata });
          batchCount++;
          updatedNodes++;
          
          // Commit batch if reaching limit
          if (batchCount >= BATCH_SIZE_LIMIT) {
            await batchOp.commit();
            batchOp = adminDb.batch();
            batchCount = 0;
          }
        }
      }
      
      // Commit any remaining batch operations
      if (batchCount > 0) {
        await batchOp.commit();
      }
      
      console.log(`[DEBUG] Updated ${updatedNodes} nodes in document ${documentId}`);
      result.nodesUpdated += updatedNodes;
    }
    
    result.success = true;
    console.log(`[DEBUG] Cleanup complete. Processed ${result.nodesProcessed} nodes, updated ${result.nodesUpdated}`);
    
    return result;
  } catch (error) {
    console.error(`[DEBUG] Error during cleanup:`, error);
    return result;
  }
}