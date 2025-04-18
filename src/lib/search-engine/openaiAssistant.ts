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
  // Create a thread
  const thread = await openai.beta.threads.create();
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: input.query
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: OPENAI_ASSISTANT_ID
  });

  // Poll for completion (simple version)
  let finalRun = run;
  let attempts = 0;
  while (
    ["queued", "in_progress", "cancelling"].includes(finalRun.status) &&
    attempts < 60
  ) {
    await new Promise(r => setTimeout(r, 100));
    finalRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    attempts++;
  }

  if (finalRun.status !== "completed") {
    throw new Error(
      `${logPrefix} Assistant did not complete. Status: ${finalRun.status}`
    );
  }

  // Get the latest assistant message
  const messages = await openai.beta.threads.messages.list(thread.id, {
    order: "desc",
    limit: 5
  });
  const assistantMsg = messages.data.find(m => m.role === "assistant");
  let response = "";
  if (assistantMsg?.content) {
    for (const c of assistantMsg.content) {
      if (c.type === "text" && c.text?.value) response += c.text.value + "\n";
    }
    response = response.trim();
  }

  if (DEBUG) console.log(`${logPrefix} Assistant response:`, response);

  return { response };
}