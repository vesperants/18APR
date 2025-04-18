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