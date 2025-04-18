// src/lib/search-engine/config.ts
// src/lib/search-engine/config.ts
export const DEBUG = process.env.DEBUG_SEARCH_ENGINE === 'true';

export const GCS_LAW_BUCKET = process.env.TXT_BUCKET_NAME || 'law_txt_files';   // <--- NEW
export const GCS_TEMP_BUCKET = process.env.TEMP_BUCKET_NAME || 'law_temp_files';

export const APP_TMP_KEY = 'latest_extracted_text.txt';

console.log('[Config] Loaded. Buckets:', GCS_LAW_BUCKET, GCS_TEMP_BUCKET);

// Gemini Model for Query Processing
export const GEMINI_QUERY_MODEL =
  process.env.GEMINI_QUERY_MODEL || 'gemini-2.0-flash';
export const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || '';

// OpenAI
export const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || '';
export const OPENAI_ASSISTANT_ID =
  process.env.OPENAI_ASSISTANT_ID || '';
// Model ID for direct Chat Completions
export const OPENAI_CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo';

export const GCS_LAW_PREFIX =
  process.env.LAW_JSON_DATA_PREFIX || ''; // Optional, e.g. 'data/'


console.log('[Config] Loaded. Buckets:', GCS_LAW_BUCKET, GCS_TEMP_BUCKET);