// ─────────────────────────────────────────────────────────────
//  File: src/app/api/chat/routes.ts
//  Firestore‑based Gemini legal assistant
//  (no GCS access; fixes tool‑call retrieval)
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenerativeAI, SchemaType, Tool, Content,
  GenerateContentResult, FunctionCall, FunctionResponsePart
} from '@google/generative-ai';
import { runLegalSearchChain } from '@/lib/search-engine';
import { retrieveLawText } from '@/lib/search-engine/toolCallStore';
import { adminDb } from '@/services/firebase/admin';

/*─────────────────────────────────────────────────────────────*/
/*  constants                                                  */
/*─────────────────────────────────────────────────────────────*/
const MODEL            = 'gemini-2.0-flash';
const ITER_LIMIT       = 6;
const STREAM_CHUNK     = 5;
const STREAM_DELAY_MS  = 10;

/*─────────────────────────────────────────────────────────────*/
/*  request / helper types                                     */
/*─────────────────────────────────────────────────────────────*/
interface FilePart { data: string; mimeType: string; }
interface ChatReq   {
  message: string;
  history?: Content[];
  files?: FilePart[];
  uid: string;
  conversationId: string;
}

function isContentArr(v: unknown): v is Content[] {
  return Array.isArray(v) && v.every(o => o && typeof o === 'object' && 'role' in o && 'parts' in o);
}
function isFileArr(v: unknown): v is FilePart[] {
  return Array.isArray(v) && v.every(f => f && typeof f.data === 'string' && typeof f.mimeType === 'string');
}
function genId() {
  return adminDb.collection('_tmp').doc().id;
}

/*─────────────────────────────────────────────────────────────*/
/*  tools                                                      */
/*─────────────────────────────────────────────────────────────*/
const legalSearchTool: Tool = {
  functionDeclarations: [{
    name: 'legalSearchEngine',
    description: 'Run a Nepali‑law search and (optionally) extract text.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query:         { type: SchemaType.STRING,  description: 'Search terms' },
        extractToggle: { type: SchemaType.BOOLEAN, description: 'If true, extract matches' }
      },
      required: ['query']
    }
  }]
};

const geminiResultsTool: Tool = {
  functionDeclarations: [{
    name: 'gemini_search_results',
    description: 'Analyse previously‑extracted law text (never translate).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userRequest: { type: SchemaType.STRING,  description: 'What user wants now' },
        toolCallId:  { type: SchemaType.STRING,  description: 'ID of earlier search (optional)' },
        lawText:     { type: SchemaType.STRING,  description: 'Filled by backend' }
      },
      required: []          // backend injects lawText
    }
  }]
};

/*─────────────────────────────────────────────────────────────*/
/*  system prompt                                              */
/*─────────────────────────────────────────────────────────────*/
const SYS_PROMPT = `
You are a highly‑skilled assistant for Nepali law.

TOOLS
• legalSearchEngine
    – run ONLY if the user clearly requests a *new* search.
• gemini_search_results
    – use this for every follow‑up question about text that
      has already been extracted.

RULES
1. After a legalSearchEngine call finishes, your FIRST
   gemini_search_results reply MUST be an outline: headings
   only (Parts / Chapters / Sections).
2. NEVER translate Nepali into English.
3. Do NOT include section bodies unless explicitly asked.
4. For clarifications, call gemini_search_results – do NOT
   start a new search unless the user asks for one.
`;

/*─────────────────────────────────────────────────────────────*/
/*  tool‑executor                                              */
/*─────────────────────────────────────────────────────────────*/
async function execTool(
  call: FunctionCall,
  firstGemini: boolean,
  ctx: { uid: string; conversationId: string; lastId?: string; lastTitle?: string; }
): Promise<FunctionResponsePart>
{
  /*―――― legalSearchEngine ――――――――――――――――――――――――――――――――*/
  if (call.name === 'legalSearchEngine') {
    const { query, extractToggle = true } = (call.args as any) ?? {};
    if (!query?.trim()) {
      return { functionResponse: { name: call.name, response: { error: 'Missing query' } } };
    }

    const id = genId();
    ctx.lastId    = id;
    ctx.lastTitle = query;

    const res = await runLegalSearchChain({
      userQuery: query,
      extractToggle,
      uid: ctx.uid,
      conversationId: ctx.conversationId,
      toolCallId: id,
      toolCallTitle: query
    });

    return { functionResponse: { name: call.name, response: res } };
  }

  /*―――― gemini_search_results ――――――――――――――――――――――――――*/
  if (call.name === 'gemini_search_results') {
    const { userRequest = '', toolCallId } = (call.args as any) ?? {};
    const id   = toolCallId || ctx.lastId;
    const key  = ctx.lastTitle;

    // ① try specific id → ② fall back to latest extract in convo
    let lawText = id && key
      ? await retrieveLawText({ uid: ctx.uid, conversationId: ctx.conversationId, toolCallId: id, key })
      : null;

    if (!lawText) {
      // fallback: most recent extract in this conversation
      const snap = await adminDb
        .collection('users').doc(ctx.uid)
        .collection('conversations').doc(ctx.conversationId)
        .collection('toolCalls')
        .orderBy('createdAt', 'desc')
        .limit(1).get();
      if (!snap.empty) lawText = snap.docs[0].data()?.content || null;
    }

    if (!lawText)
      lawText = '[No extracted law text found]';

    const outlineReq =
      'List all Parts, Chapters and Section headings in hierarchy order.';
    const effectiveReq = firstGemini
      ? outlineReq
      : (userRequest.trim() || 'Summarise the requested part.');

    return {
      functionResponse: {
        name: call.name,
        response: {
          userRequest: effectiveReq,
          lawText: lawText.slice(0, 40_000)   // safety cut
        }
      }
    };
  }

  return { functionResponse: { name: call.name, response: { error: `Unknown tool ${call.name}` } } };
}

/*─────────────────────────────────────────────────────────────*/
/*  route handler                                              */
/*─────────────────────────────────────────────────────────────*/
export async function POST(req: NextRequest): Promise<Response> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY)
    return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });

  /*── parse request ─────────────────────────────────────────*/
  let body: ChatReq;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  if (!body.uid || !body.conversationId)
    return NextResponse.json({ error: 'uid / conversationId missing' }, { status: 400 });
  if (typeof body.message !== 'string' || !body.message.trim())
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  if (body.files && !isFileArr(body.files))
    return NextResponse.json({ error: 'Bad files array' }, { status: 400 });

  const history   = isContentArr(body.history) ? body.history : [];
  const ctx       = { uid: body.uid, conversationId: body.conversationId } as
                    { uid: string; conversationId: string; lastId?: string; lastTitle?: string; };
  let firstGemini = true;
  let answer: string | null = null;

  /*── model setup ───────────────────────────────────────────*/
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'system', parts: [{ text: SYS_PROMPT }] }
  });

  /*── assemble initial user turn ────────────────────────────*/
  const parts = [
    { text: body.message },
    ...(body.files ?? []).map(f => ({ inlineData: { mimeType: f.mimeType, data: f.data } }))
  ];
  let current: Content = { role: 'user', parts };

  /*── dialogue loop ─────────────────────────────────────────*/
  for (let turn = 0; turn < ITER_LIMIT; ++turn) {
    const convo = [...history, current];

    /* choose tools: if we haven’t searched yet or user explicitly
       asks to, expose both; otherwise just the results tool */
    const expose: Tool[] =
      (!ctx.lastId || /\b(search|खोज)\b/i.test(body.message))
        ? [legalSearchTool, geminiResultsTool]
        : [geminiResultsTool];

    const ai = await model.generateContent({ contents: convo, tools: expose });
    const cand = ai.response.candidates?.[0];
    if (!cand) throw new Error('No candidate');

    let fnCall: FunctionCall | undefined;
    let text = '';
    for (const p of cand.content.parts) {
      if (p.text)          text += p.text;
      if (p.functionCall)  fnCall = p.functionCall;
    }
    text = text.trim();

    if (text && !fnCall) {                // plain answer
      answer = text;
      break;
    }

    history.push(
      fnCall
        ? { role: 'model', parts: [{ functionCall: fnCall }] }
        : { role: 'model', parts: [{ text }] }
    );

    if (!fnCall) { answer = '[No response]'; break; }

    const fnResp = await execTool(fnCall, fnCall.name === 'gemini_search_results' && firstGemini, ctx);

    if (fnCall.name === 'gemini_search_results') firstGemini = false;
    if (fnCall.name === 'legalSearchEngine')      firstGemini = true;

    current = { role: 'function', parts: [fnResp] };
  }

  /*── stream back answer ────────────────────────────────────*/
  const out = answer ?? '[Error: no response]';
  const enc = new TextEncoder();
  const ts  = new TransformStream();
  const wr  = ts.writable.getWriter();

  (async () => {
    for (let i = 0; i < out.length; i += STREAM_CHUNK) {
      await wr.write(enc.encode(out.slice(i, i + STREAM_CHUNK)));
      if (i + STREAM_CHUNK < out.length)
        await new Promise(r => setTimeout(r, STREAM_DELAY_MS));
    }
    await wr.close();
  })().catch(async e => { try { await wr.abort(e); } catch {} });

  return new Response(ts.readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
}