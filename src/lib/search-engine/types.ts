// src/lib/search-engine/types.ts
export interface QueryProcessorInput {
  query: string;
}
export interface QueryProcessorOutput {
  processedQuery: string;
}
export interface OpenAIAssistantInput {
  query: string;
}
export interface OpenAIAssistantOutput {
  response: string;
}
export interface TextExtractorInput {
  assistantText: string;
  toggleExtract: boolean;
}
export interface TextExtractorOutput {
  extractedText: string;
  filesUsed?: string[];
  detectedStructure?: DocumentStructureInfo;
}
export interface TempBucketStoreInput {
  key: string; // The title of the query
  content: string;
}
export interface TempBucketRetrieveInput {
  key: string; // The title of the query to lookup
}
export interface TempBucketRetrieveOutput {
  content: string | null;
}
export interface LegalSearchChainOutput {
  finalText: string;
  filesFetched: string[];
  error?: string;
}

/**
 * Information about the hierarchical structure of the document
 */
export interface DocumentStructureInfo {
  format: string; // 'pcs', 'ps', 'cs', 'article', 'section', or custom format
  levels: string[]; // Names of the hierarchical levels, e.g. ['part', 'chapter', 'section']
  levelSeparator: string; // Character used to separate levels, typically '-'
  levelPrefixes: Record<string, string>; // Prefixes for each level, e.g. {part: 'P', chapter: 'C'}
}

/**
 * Represents a generic hierarchical node with any structure
 */
export interface GenericHierarchyNode {
  id: string;
  type: string; // Can be any level type: 'part', 'chapter', 'section', 'article', etc.
  title: string;
  content?: string;
  children?: GenericHierarchyNode[];
  metadata?: Record<string, unknown>;
  parentId?: string;
}



/**
 * Represents a structured law section with title and content
 */
export interface LawSection {
  title: string;
  content: string;
  toolCallId: string;
  createdAt: Date;
}

/**
 * Parameters for retrieving just the titles of law sections
 */
export interface SectionTitlesRetrievalParams {
  uid: string;
  conversationId: string;
}

/**
 * Parameters for retrieving a specific law section
 */
export interface SectionTextRetrievalParams {
  uid: string;
  conversationId: string;
  sectionId: string;
  toolCallId?: string;
}

/**
 * Hierarchical section interfaces for structured response
 */
export interface SectionInfo {
  blockId: string;
  pcsId: string;
  title: string;
}

export interface ChapterInfo {
  chapterId: string;
  title: string;
  sections: SectionInfo[];
}

export interface PartInfo {
  partId: string;
  title: string;
  chapters: ChapterInfo[];
}

export interface DocumentInfo {
  documentId: string;
  parts: PartInfo[];
}

export interface FileInfo {
  fileId: string;
  title: string;
  documents: DocumentInfo[];
}

export interface HierarchicalTitlesResponse {
  messageId: string;
  conversationId: string;
  toolCallId: string;
  message: string;
  files: FileInfo[];
}

/**
 * Generic node-based hierarchical structure for more flexibility
 */
export interface HierarchyNode {
  nodeId: string;
  nodeType: string; // 'part', 'chapter', 'section', etc.
  nodeTitle: string;
  children?: HierarchyNode[];
  content?: string; // Only for leaf nodes (sections)
  metadata?: Record<string, unknown>;
}

/**
 * Document hierarchy using the flexible node structure
 */
export interface DocumentHierarchy {
  documentId: string;
  documentTitle: string;
  nodes: HierarchyNode[];
  documentStructure?: DocumentStructureInfo;
}

/**
 * Complete flexible hierarchical response format
 */
export interface FlexibleHierarchicalResponse {
  messageId: string;
  conversationId: string;
  toolCallId: string;
  message: string;
  documents: DocumentHierarchy[];
}