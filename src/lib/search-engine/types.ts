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