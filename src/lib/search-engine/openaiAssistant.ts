// src/lib/search-engine/openaiAssistant.ts

import OpenAI from "openai";
import { OPENAI_API_KEY, OPENAI_ASSISTANT_ID, DEBUG } from "./config";
import type { OpenAIAssistantInput, OpenAIAssistantOutput } from "./types";

const logPrefix = "[OpenAIAssistant]";

if (!OPENAI_API_KEY) throw new Error(`${logPrefix} OPENAI_API_KEY is not set.`);
if (!OPENAI_ASSISTANT_ID) throw new Error(`${logPrefix} OPENAI_ASSISTANT_ID is not set.`);

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function queryOpenAIAssistant(
  input: OpenAIAssistantInput
): Promise<OpenAIAssistantOutput> {
  const query = input.query;
  console.log(`${logPrefix} queryOpenAIAssistant called with query:`, query);
  // 1) Create a new assistant thread
  console.log(`${logPrefix} Creating thread via beta.threads.create()`);
  const thread = await openai.beta.threads.create();
  console.log(`${logPrefix} Thread created: id=${thread.id}`);

  // 2) Send the user query to the thread
  console.log(`${logPrefix} Sending user message to thread`);
  await openai.beta.threads.messages.create(thread.id, { role: "user", content: query });

  // 3) Start an assistant run using the configured assistant ID
  console.log(`${logPrefix} Starting assistant run with assistant_id=${OPENAI_ASSISTANT_ID}`);
  const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: OPENAI_ASSISTANT_ID });
  console.log(`${logPrefix} Run created:`, run);

  // 4) Poll until the run finishes or fails
  let finalRun = run;
  let attempts = 0;
  while (["queued", "in_progress", "cancelling"].includes(finalRun.status) && attempts < 60) {
    if (DEBUG) console.log(`${logPrefix} run status=${finalRun.status}, polling... (${attempts})`);
    await new Promise((r) => setTimeout(r, 100));
    finalRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    attempts++;
  }
  // 5) Check for completion or failure
  if (finalRun.status !== "completed") {
    console.error(`${logPrefix} Run ended with status=${finalRun.status} after ${attempts} polls`);
    console.error(`${logPrefix} finalRun object:`, finalRun);
    if ((finalRun as any).incomplete_details) console.error(`${logPrefix} incomplete_details:`, (finalRun as any).incomplete_details);
    if ((finalRun as any).last_error) console.error(`${logPrefix} last_error:`, (finalRun as any).last_error);
    throw new Error(`${logPrefix} Assistant failed to complete. Status: ${finalRun.status}`);
  }
  console.log(`${logPrefix} Assistant run completed, retrieving messages`);

  // 6) Fetch the assistant's response message
  const messages = await openai.beta.threads.messages.list(thread.id, { order: "desc", limit: 5 });
  const assistantMsg = messages.data.find((m) => m.role === "assistant");
  if (!assistantMsg?.content) {
    throw new Error(`${logPrefix} No assistant content found in thread messages`);
  }

  // 7) Aggregate text chunks into a single string
  let response = "";
  for (const part of assistantMsg.content) {
    if (part.type === "text" && part.text?.value) response += part.text.value + "\n";
  }
  response = response.trim();
  console.log(`${logPrefix} Assistant response:`, response);

  return { response };
}