import { Storage } from "@google-cloud/storage";
import {
  GCS_LAW_BUCKET,
  DEBUG,
} from "./config";
import type { TextExtractorInput, TextExtractorOutput } from "./types";

const logPrefix = "[TextExtractor]";
const storage = new Storage();
const lawBucket = storage.bucket(GCS_LAW_BUCKET);

// Utility: Extract valid JSON "object" from a string (even with Markdown, pre/post text)
function robustJsonParse(text: string): any {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) throw new Error("No JSON object found.");
  let possibleJson = text.substring(firstBrace, lastBrace + 1);
  possibleJson = possibleJson.replace(/,\s*([\]}])/g, '$1');
  return JSON.parse(possibleJson);
}
function normalize(str: string): string {
  return (str || "")
    .replace(/[\u2018\u2019\u201C\u201D\u0060\u00AB\u00BB]/g,'"')
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "")
    .trim();
}

// Utility: Logs ALL lines that match section header format
function logSectionHeaders(lines: string[]) {
  const headers = [];
  for (let i = 0; i < lines.length; ++i) {
    const norm = normalize(lines[i]);
    if (/^P\d+-C\d+-S\d+$/.test(norm)) {
      headers.push({ line: i, header: norm, raw: lines[i] });
    }
  }
  if (DEBUG) {
    console.log(`[TextExtractor] ----- SECTION HEADER SUMMARY -----`);
    headers.forEach(h => console.log(`[Header in file] Line ${h.line}: >${h.raw}< (normalized: ${h.header})`));
    if (!headers.length) {
      console.log('[TextExtractor] (No section headers detected in file!)');
    }
    console.log(`[TextExtractor] -----------------------------------`);
  }
}

// Returns: Array of {index, header, part, chapter, section, raw}
function extractSectionHeaders(lines: string[]) {
  const result = [];
  for (let i = 0; i < lines.length; ++i) {
    const norm = normalize(lines[i]);
    const m = /^P(\d+)-C(\d+)-S(\d+)$/.exec(norm);
    if (m) {
      result.push({
        index: i,
        header: norm,
        part: m[1],
        chapter: m[2],
        section: m[3],
        raw: lines[i]
      });
    }
  }
  return result;
}

// Expand every detected Pn-Cm-Sx OR Pn-Cm to all S in file under this Pn-Cm:
function expandSectionsToFullChapters(sectionList: string[], lines: string[]): string[] {
  const allHeaders = extractSectionHeaders(lines);

  // Get set of "chapter keys" (Pn-Cm)
  const requestedChapters = new Set<string>();
  sectionList.forEach((sec) => {
    const m = /^P(\d+)-C(\d+)-S(\d+)$/.exec(normalize(sec));
    if (m) {
      requestedChapters.add(`P${m[1]}-C${m[2]}`);
    } else {
      const n = /^P(\d+)-C(\d+)$/.exec(normalize(sec));
      if (n) requestedChapters.add(`P${n[1]}-C${n[2]}`);
    }
  });

  // All Pn-Cm-Sxx under any requested Pn-Cm
  const expandedSections: string[] = [];
  for (const entry of allHeaders) {
    const chKey = `P${entry.part}-C${entry.chapter}`;
    if (requestedChapters.has(chKey)) {
      expandedSections.push(entry.header);
    }
  }
  return Array.from(new Set(expandedSections));
}

// NEW: Expanded section extraction!
function extractSectionsFromText(
  fullText: string,
  sectionList: string[]
): { sectionsFound: string[]; extracted: string; notFound: string[] } {
  const lines = fullText.split(/\r?\n/);
  if (DEBUG) {
    console.log(`[TextExtractor] ===== File Preview: First 10 lines =====`);
    lines.slice(0, 10).forEach((l, i) => console.log(`${i}: ${l}`));
    console.log(`[TextExtractor] =======================================`);
  }
  logSectionHeaders(lines);

  // -------- Expand to all Pn-Cm-Sx under any requested chapter --------
  const expandedSectionList = expandSectionsToFullChapters(sectionList, lines);
  if (DEBUG) {
    console.log(`[TextExtractor] After expandSectionsToFullChapters():`, expandedSectionList);
  }
  //--------------------------------------------------------------------

  const normalizedSections = expandedSectionList.map(normalize);
  const sectionIndices: { [section: string]: number } = {};
  normalizedSections.forEach(sec => { sectionIndices[sec] = -1; });
  for (let i = 0; i < lines.length; ++i) {
    const normLine = normalize(lines[i]);
    if (sectionIndices.hasOwnProperty(normLine)) {
      sectionIndices[normLine] = i;
    }
  }
  // Try loose/fuzzy match if strict fails
  for (let k = 0; k < normalizedSections.length; ++k) {
    if (sectionIndices[normalizedSections[k]] < 0) {
      for (let i = 0; i < lines.length; ++i) {
        if (normalize(lines[i]) === normalizedSections[k]) {
          sectionIndices[normalizedSections[k]] = i;
          break;
        }
      }
    }
  }
  // EXTRACT!
  let resultText = "";
  const foundSections: string[] = [];
  const notFound: string[] = [];
  for (let sidx = 0; sidx < normalizedSections.length; ++sidx) {
    const nSectionKey = normalizedSections[sidx];
    const originalSectionKey = expandedSectionList[sidx];
    const startIdx = sectionIndices[nSectionKey];
    if (startIdx >= 0) {
      foundSections.push(originalSectionKey);
      resultText += `\n---- [${originalSectionKey}] ----\n`;
      let endIdx = lines.length;
      for (let i = startIdx + 1; i < lines.length; ++i) {
        if (/^P\d+-C\d+-S\d+$/.test(normalize(lines[i]))) {
          endIdx = i;
          break;
        }
      }
      resultText += lines.slice(startIdx, endIdx).join('\n') + "\n";
      if (DEBUG) {
        console.log(`[TextExtractor] Section [${originalSectionKey}] extracted from line ${startIdx} to ${endIdx-1}`);
      }
    } else {
      notFound.push(originalSectionKey);
      if (DEBUG)
        console.log(`[TextExtractor] Section header [${originalSectionKey}] was NOT found in file`);
    }
  }
  if (DEBUG) {
    console.log(`[TextExtractor] Extraction complete. Requested: ${expandedSectionList.length}, Found: ${foundSections.length}, Not found: ${notFound.length}`);
    if (notFound.length) console.log(`[TextExtractor] --- Missing section(s): ${notFound.join(', ')}`);
  }
  if (!resultText.trim()) {
    resultText = `No relevant sections found: ${expandedSectionList.join(", ")}`;
  } else if (notFound.length > 0) {
    resultText += `\n\n[WARN] Section(s) not found: ${notFound.join(", ")}`;
  }
  return { sectionsFound: foundSections, extracted: resultText.trim(), notFound };
}

export async function processAssistantText(
  input: TextExtractorInput
): Promise<TextExtractorOutput> {
  if (!input.toggleExtract) {
    if (DEBUG) console.log(`${logPrefix} Toggle OFF, returning as-is.`);
    return { extractedText: input.assistantText };
  }
  try {
    let jsonMsg: any;
    try {
      jsonMsg = robustJsonParse(input.assistantText);
    } catch (err) {
      console.log('[TextExtractor] ERROR: Assistant output is not valid JSON.');
      throw new Error(
        "Assistant output is not valid JSON or cannot be parsed robustly. Got: " +
        input.assistantText
      );
    }
    let docName: string = (jsonMsg.doc_name || "").trim();
    if (!docName.endsWith('.txt')) docName += '.txt';
    let docSections: string[] = Array.isArray(jsonMsg.relevant_sections)
      ? jsonMsg.relevant_sections.map((s: any) => String(s).trim())
      : [];
    if (!docName || !docSections.length) {
      console.log('[TextExtractor] ERROR: Missing doc_name or relevant_sections:', jsonMsg);
      throw new Error(
        "JSON missing doc_name or relevant_sections. Got: " +
        JSON.stringify(jsonMsg)
      );
    }
    if (DEBUG) {
      console.log(`[TextExtractor] GCS_LAW_BUCKET: ${GCS_LAW_BUCKET}`);
      console.log(`[TextExtractor] Attempting to load: "${docName}"`);
      console.log(`[TextExtractor] Sections to extract:`, docSections.join(', '));
    }
    const file = lawBucket.file(docName);
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`[TextExtractor] ERROR: File does NOT exist in bucket: ${docName}`);
      throw new Error(`Document not found in bucket: ${docName}`);
    }
    const [fileContents] = await file.download();
    const fullText = fileContents.toString("utf8");
    const { sectionsFound, extracted, notFound } = extractSectionsFromText(
      fullText,
      docSections
    );
    if (DEBUG) {
      console.log(`[TextExtractor] Extraction complete for file: ${docName}`);
      console.log(`[TextExtractor] Sections found:`, sectionsFound);
      if (notFound.length) console.log(`[TextExtractor] Sections not found:`, notFound);
      console.log(`[TextExtractor] ----- EXTRACTED PREVIEW -----\n${extracted.slice(0, 500)}\n---------------------------`);
    }
    return {
      extractedText: extracted,
      filesUsed: [docName, ...sectionsFound],
    };
  } catch (err) {
    console.log(`[TextExtractor] [FATAL ERROR]: ${err}`);
    return {
      extractedText: `[Error extracting: ${(err as Error)?.message}]`,
    };
  }
}