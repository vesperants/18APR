// src/lib/search-engine/queryProcessor.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_QUERY_MODEL, GEMINI_API_KEY, DEBUG } from "./config";
import type { QueryProcessorInput, QueryProcessorOutput } from "./types";

const logPrefix = "[QueryProcessor]";

export async function processQueryWithGemini(
  input: QueryProcessorInput
): Promise<QueryProcessorOutput> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_QUERY_MODEL });

  const prompt =
    `Your job is to append a processed version of a legal search query for maximum clarity and relevance. Add keywords related to the concept and even connected concepts/phrases - we want to retrieve various contents related to it. Keep it information-rich. Reply with the original query along with the appended keywords and phrases \n\nUser query:\n${input.query}\n\nProcessed Query:`;

  if (DEBUG) console.log(`${logPrefix} Calling Gemini for query:`, input.query);

  const resp = await model.generateContent(prompt);
  const processed =
    resp.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    input.query;

  if (DEBUG) console.log(`${logPrefix} Gemini response:`, processed);

  return { processedQuery: processed };
}