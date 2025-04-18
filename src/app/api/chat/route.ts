import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenerativeAI, SchemaType, Part, Tool, Content, GenerateContentResult,
  FunctionCall, FunctionResponsePart,
} from "@google/generative-ai";
import { runLegalSearchChain } from '@/lib/search-engine';
import { retrieveFromTempBucket } from '@/lib/search-engine/tempBucket';

// REMOVE CLIENT SDKS -- backend must NEVER use these for writes
// import { collection, doc } from 'firebase/firestore';
// import { db } from '@/services/firebase/config';

// Use admin SDK for secure backend-only Firestore
import { adminDb } from '@/services/firebase/admin'; // <--- ADD THIS

const MAIN_MODEL_NAME = "gemini-2.0-flash";
const MAX_TOOL_ITERATIONS = 6;
const STREAM_CHUNK_DELAY_MS = 10;
const STREAM_CHUNK_SIZE = 5;
const logPrefix = "[API Route Gemini]";

interface FilePartData { data: string; mimeType: string; }

interface ChatRequestBody {
  message: string;
  history?: Content[];
  files?: FilePartData[];
  uid: string;
  conversationId: string;
}

const legalSearchTool: Tool = {
  functionDeclarations: [{
    name: "legalSearchEngine",
    description: "Searches and analyzes relevant Nepali legal information based on a query. Use for questions about Nepali law, constitution, acts, regulations, or analyzing case details.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "The user's full query or the core legal concept/keywords." },
        extractToggle: { type: SchemaType.BOOLEAN, description: "If true, will extract referenced documents from the law bucket." }
      },
      required: ["query"]
    }
  }]
};
const geminiSearchResultsTool: Tool = {
  functionDeclarations: [{
    name: "gemini_search_results",
    description: "Given the extracted law text relevant to the user's request, analyze it in full context of the conversation and return either a summary, headers, or extract a specific point, depending on the chat and user followup. DONOT TRANSLATE NEPALI INTO ENGLISH. GIVE AS IT.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userRequest: { type: SchemaType.STRING, description: "User followup, if any, focusing what kind of answer is wanted. Empty for general summary." },
        lawText: { type: SchemaType.STRING, description: "Full extracted law text relevant to the query, as provided by the backend." }
      },
      required: ["lawText"]
    }
  }]
};

const systemInstructionText = `
You are a highly intelligent legal assistant specializing in Nepali law.
TOOLS AVAILABLE:
1. 'legalSearchEngine' — Use this tool to perform Nepali legal research and extract relevant provisions, articles, or analysis.
2. 'gemini_search_results' — ALWAYS call this after extracting law text. Do not answer user questions directly from extraction.
Special Rules:
- ON FIRST ANALYSIS after extraction, your reply MUST be a table of contents of Parts, Chapters, and Sections (headers/titles only).
- DO NOT TRANSLATE FROM NEPALI TO ENGLISH EVER. RETURN NEPALI TEXT AS IS.
- Do NOT include actual law text or summaries first. Only provide details or summaries if the user requests a specific Part/Chapter/Section, or detail, in a follow-up.
- Example:
Part 1: प्रारम्भिक
 Chapter 1: सामान्य व्यवस्था
 Section 1: संक्षिप्त नाम र प्रारम्भ
 Section 2: परिभाषा
- If the law text has no such structure, provide major available headings.
- For all subsequent follow-up questions: reply ONLY using the Gemini tool to reference and summarize the relevant section/body, never dumping the full text unless explicitly demanded.
- Politely ask the user if they want to see the details for a particular section or part.
- If the users asks to search again, confirm if they want to perform a new search (in which case we do a legal search again) or if they want to see the details of a specific section.
`;
const systemInstructionPart: Part = { text: systemInstructionText };
const systemInstructionContent: Content = { role: "system", parts: [systemInstructionPart] };

function isContentArray(value: unknown): value is Content[] {
  return Array.isArray(value) && value.every(item => typeof item === 'object' && item !== null && 'role' in item && 'parts' in item);
}
function isValidFileData(files: unknown): files is FilePartData[] {
  return Array.isArray(files) && files.every(file => typeof file === 'object' && file !== null && typeof file.data === 'string' && typeof file.mimeType === 'string');
}

// --- THIS FUNCTION GENERATES FIRESTORE IDs SERVER-SIDE WITH ADMIN SDK ---
// If you want to generate a random Firestore id with Admin SDK:
function generateFirestoreId(): string {
  // Use admin Firestore id generating hack:
  return adminDb.collection('_simulate').doc().id;
}

async function executeSingleToolCall(
  functionCall: FunctionCall,
  isFirstGemini: boolean,
  toolContext: { uid: string, conversationId: string, toolCallId?: string, toolCallTitle?: string }
): Promise<FunctionResponsePart> {
  const toolName = functionCall.name;
  let toolResultOutput: any;

  if (toolName === 'legalSearchEngine') {
    const args = functionCall.args ? (functionCall.args as any) : {};
    const toolQuery = args.query?.trim();
    const extractToggle = args.extractToggle ?? true;
    if (!toolQuery) {
      toolResultOutput = { finalText: "", filesFetched: [], error: "Missing query parameter." };
    } else {
      try {
        const toolCallId = generateFirestoreId();
        toolContext.toolCallId = toolCallId;
        toolContext.toolCallTitle = toolQuery;
        toolResultOutput = await runLegalSearchChain({
          userQuery: toolQuery,
          extractToggle,
          uid: toolContext.uid,
          conversationId: toolContext.conversationId,
          toolCallId,
          toolCallTitle: toolQuery
        });
        toolResultOutput._toolCallId = toolCallId;
        toolResultOutput._toolCallTitle = toolQuery;
      } catch (toolError) {
        const toolErrorDetails = toolError instanceof Error ? toolError.message : String(toolError);
        toolResultOutput = { finalText: "", filesFetched: [], error: `Tool execution failed: ${toolErrorDetails}` };
      }
    }
    return { functionResponse: { name: toolName, response: toolResultOutput } };
  } else if (toolName === 'gemini_search_results') {
    const args = functionCall.args ? (functionCall.args as any) : {};
    if (!toolContext.toolCallId || !toolContext.toolCallTitle) {
      return { functionResponse: { name: toolName, response: { userRequest: args.userRequest, lawText: "[No extracted law text found]" } } };
    }
    const temp = await retrieveFromTempBucket({
      uid: toolContext.uid,
      conversationId: toolContext.conversationId,
      toolCallId: toolContext.toolCallId,
      key: toolContext.toolCallTitle,
    });
    const lawText = temp?.content || "[No extracted law text found]";
    let effectiveUserRequest =
      args.userRequest && typeof args.userRequest === "string" && args.userRequest.trim().length > 0
        ? args.userRequest
        : "List all available Parts, Chapters, and Section numbers and titles from the provided law text, in hierarchy order, without any explanations or actual section content. Omit any law text and do not summarize the section contents. Only provide the outline/headers.";
    if (isFirstGemini) {
      effectiveUserRequest = "List all available Parts, Chapters, and Section numbers and titles from the provided law text, in hierarchy order, without any explanations or actual section content. Omit any law text and do not summarize the section contents. Only provide the outline/headers.";
    }
    toolResultOutput = {
      userRequest: effectiveUserRequest,
      lawText: lawText.length > 40000 ? lawText.slice(0, 40000) : lawText,
    };
    return { functionResponse: { name: toolName, response: toolResultOutput } };
  } else {
    toolResultOutput = { finalText: "", filesFetched: [], error: `Unknown tool requested: ${toolName}` };
    return { functionResponse: { name: toolName, response: toolResultOutput } };
  }
}

// ---

export async function POST(request: NextRequest): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  let requestBody: ChatRequestBody;
  let userMessageText: string;
  let userFiles: FilePartData[] = [];
  let incomingHistory: Content[] = [];
  let conversationTurns: Content[] = [];
  let uid: string;
  let conversationId: string;

  // ---- Extract and validate request
  try {
    requestBody = await request.json();
    userMessageText = requestBody.message;
    uid = requestBody.uid;
    conversationId = requestBody.conversationId;
    if (!uid || !conversationId) throw new Error("Missing user or conversation id");
    const rawHistory = requestBody.history;
    incomingHistory = isContentArray(rawHistory) ? rawHistory : [];
    conversationTurns = incomingHistory.filter(() => true);
    const rawFiles = requestBody.files;
    if (typeof userMessageText !== 'string') { throw new Error("Invalid message format"); }
    if (rawFiles !== undefined) {
      if (!isValidFileData(rawFiles)) { throw new Error("Invalid files format"); }
      userFiles = rawFiles;
    }
    if (userMessageText.trim().length === 0 && userFiles.length === 0) { throw new Error("Empty message/files"); }
  } catch (parseError) {
    return NextResponse.json({ error: 'Failed to parse request body', details: String(parseError) }, { status: 400 });
  }

  // -- Run conversational loop
  try {
    const genAIInstance = new GoogleGenerativeAI(apiKey);
    const conversationModel = genAIInstance.getGenerativeModel({
      model: MAIN_MODEL_NAME,
      systemInstruction: systemInstructionContent,
      tools: [legalSearchTool, geminiSearchResultsTool]
    });
    const userParts: Part[] = [];
    if (userFiles.length > 0) { userFiles.forEach((file) => { userParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } }); }); }
    if (userMessageText.trim().length > 0) { userParts.push({ text: userMessageText }); }
    let currentTurnContentForNextIteration: Content = { role: 'user', parts: userParts };
    let finalUserFacingText: string | null = null;
    let iteration = 0;
    let toolContext: { uid: string, conversationId: string, toolCallId?: string, toolCallTitle?: string } = { uid, conversationId };
    let isFirstGeminiSearch = true;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;
      conversationTurns.push(currentTurnContentForNextIteration);
      const contentsToSend: Content[] = [...conversationTurns];
      let result: GenerateContentResult;
      try {
        result = await conversationModel.generateContent({ contents: contentsToSend });
      } catch (generationError) {
        throw new Error(`AI generation failed: ${generationError instanceof Error ? generationError.message : String(generationError)}`);
      }
      const response = result.response;
      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error("No candidate returned from AI generation");
      }
      const modelResponseParts = candidate.content.parts;
      let functionCall: FunctionCall | undefined = undefined;
      let responseText = "";
      for (const part of modelResponseParts) {
        if (part.text) responseText += part.text;
        if (part.functionCall && typeof part.functionCall === 'object') functionCall = part.functionCall;
      }
      responseText = responseText.trim();
      if (responseText && !functionCall) {
        finalUserFacingText = responseText;
        break;
      }
      let modelTurnToAdd: Content = functionCall
        ? { role: 'model', parts: [{ functionCall }] }
        : { role: 'model', parts: [{ text: responseText }] };
      conversationTurns.push(modelTurnToAdd);
      if (functionCall) {
        const functionResponsePart = await executeSingleToolCall(
          functionCall,
          (functionCall.name === "gemini_search_results") && isFirstGeminiSearch,
          toolContext
        );
        const legalSearchResponse = functionResponsePart.functionResponse?.response as { _toolCallId?: string; _toolCallTitle?: string };
        if (functionCall.name === "legalSearchEngine" && legalSearchResponse?._toolCallId) {
          toolContext.toolCallId = legalSearchResponse._toolCallId;
          toolContext.toolCallTitle = legalSearchResponse._toolCallTitle;
        }
        if (functionCall.name === "gemini_search_results") isFirstGeminiSearch = false;
        currentTurnContentForNextIteration = { role: 'function', parts: [functionResponsePart] };
      } else {
        break;
      }
    }

    let finalReplyToSend: string =
      (finalUserFacingText && typeof finalUserFacingText === "string" && finalUserFacingText.trim().length > 0)
        ? finalUserFacingText
        : "[Error: No valid response generated.]";
    // Stream Final Reply
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    (async () => {
      try {
        for (let i = 0; i < finalReplyToSend.length; i += STREAM_CHUNK_SIZE) {
          const chunk = finalReplyToSend.slice(i, i + STREAM_CHUNK_SIZE);
          await writer.write(encoder.encode(chunk));
          if (i + STREAM_CHUNK_SIZE < finalReplyToSend.length) {
            await new Promise(resolve => setTimeout(resolve, STREAM_CHUNK_DELAY_MS));
          }
        }
        await writer.close();
      } catch (streamError) {
        try { await writer.abort(streamError); } catch { }
      }
    })();
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error processing chat.', details: errorMessage }, { status: 500 });
  }
}