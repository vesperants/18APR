//src/lib/search-engine/textExtractor.ts

import { Storage } from "@google-cloud/storage";
import {
  GCS_LAW_BUCKET,
  DEBUG,
} from "./config";
import type { TextExtractorInput, TextExtractorOutput, DocumentStructureInfo } from "./types";

const logPrefix = "[TextExtractor]";
const storage = new Storage();
const lawBucket = storage.bucket(GCS_LAW_BUCKET);
/**
 * Preload the list of files in the law bucket to avoid repeated exists checks.
 */
const lawFilesPromise: Promise<Set<string>> = (async () => {
  const [files] = await lawBucket.getFiles();
  return new Set(files.map(f => f.name));
})();

// Utility: Extract valid JSON "object" from a string (even with Markdown, pre/post text)
function robustJsonParse(text: string): Record<string, unknown> {
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
// This function is kept for debugging purposes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logSectionHeaders(lines: string[]): void {
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

/**
 * Analyzes section IDs to determine document structure
 * This function detects known patterns and also tries to infer arbitrary structures
 */
function analyzeDocumentStructure(sectionIds: string[]): DocumentStructureInfo {
  if (sectionIds.length === 0) {
    return {
      format: 'unknown',
      levels: ['section'],
      levelSeparator: '-',
      levelPrefixes: { section: 'S' }
    };
  }

  // Count occurrences of each format
  const patterns: Record<string, {
    regex: RegExp, 
    format: string,
    levels: string[],
    prefixes: Record<string, string>
  }> = {
    pcs: { 
      regex: /^P\d+-C\d+-S\d+$/,
      format: 'pcs', 
      levels: ['part', 'chapter', 'section'],
      prefixes: { part: 'P', chapter: 'C', section: 'S' }
    },
    ps: { 
      regex: /^P\d+-S\d+$/,
      format: 'ps', 
      levels: ['part', 'section'],
      prefixes: { part: 'P', section: 'S' }
    },
    cs: { 
      regex: /^C\d+-S\d+$/,
      format: 'cs', 
      levels: ['chapter', 'section'],
      prefixes: { chapter: 'C', section: 'S' }
    },
    article: { 
      regex: /^ART\d+$/,
      format: 'article', 
      levels: ['article'],
      prefixes: { article: 'ART' }
    },
    section: { 
      regex: /^S\d+$/,
      format: 'section', 
      levels: ['section'],
      prefixes: { section: 'S' }
    },
  };
  
  // Count occurrences of each pattern
  const counts: Record<string, number> = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    counts[key] = sectionIds.filter(id => pattern.regex.test(id)).length;
  }

  // Find the dominant pattern
  let dominant = 'unknown';
  let maxCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = key;
    }
  }

  // If we found a known pattern, return its structure info
  if (dominant !== 'unknown' && maxCount > 0) {
    const pattern = patterns[dominant];
    return {
      format: pattern.format,
      levels: pattern.levels,
      levelSeparator: '-',
      levelPrefixes: pattern.prefixes
    };
  }

  // If no pattern matched, try to infer structure from the first section ID
  // This handles arbitrary hierarchical structures
  if (sectionIds.length > 0) {
    return inferDocumentStructure(sectionIds[0]);
  }

  // Default fallback
  return {
    format: 'unknown',
    levels: ['section'],
    levelSeparator: '-',
    levelPrefixes: { section: 'S' }
  };
}

/**
 * Infers document structure from a single section ID by analyzing its pattern
 */
function inferDocumentStructure(sectionId: string): DocumentStructureInfo {
  // Check if the section has a separator
  const separator = sectionId.includes('-') ? '-' : 
                    sectionId.includes('.') ? '.' :
                    sectionId.includes('/') ? '/' : null;
  
  if (!separator) {
    // Single level structure
    // Try to extract the prefix and level type
    const match = sectionId.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const levelType = inferLevelTypeFromPrefix(prefix);
      
      return {
        format: levelType,
        levels: [levelType],
        levelSeparator: '-', // Default separator
        levelPrefixes: { [levelType]: prefix }
      };
    }
    
    // Couldn't identify structure, use generic
    return {
      format: 'generic',
      levels: ['section'],
      levelSeparator: '-',
      levelPrefixes: { section: 'S' }
    };
  }
  
  // Multi-level structure with separator
  const parts = sectionId.split(separator);
  const levels: string[] = [];
  const prefixes: Record<string, string> = {};
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const match = part.match(/^([A-Za-z]+)(\d+)$/);
    
    if (match) {
      const prefix = match[1];
      const levelType = inferLevelTypeFromPrefix(prefix);
      
      levels.push(levelType);
      prefixes[levelType] = prefix;
    } else {
      // If we can't identify the pattern, use a generic level name
      const levelType = `level${i+1}`;
      levels.push(levelType);
      prefixes[levelType] = part.replace(/\d+$/, '');
    }
  }
  
  return {
    format: levels.join('-'),
    levels,
    levelSeparator: separator,
    levelPrefixes: prefixes
  };
}

/**
 * Infers the level type based on common prefixes
 */
function inferLevelTypeFromPrefix(prefix: string): string {
  prefix = prefix.toUpperCase();
  
  const knownPrefixes: Record<string, string> = {
    'P': 'part',
    'PT': 'part',
    'PART': 'part',
    'C': 'chapter',
    'CH': 'chapter',
    'CHAP': 'chapter',
    'S': 'section',
    'SEC': 'section',
    'A': 'article',
    'ART': 'article',
    'T': 'title',
    'TIT': 'title',
    'D': 'division',
    'DIV': 'division',
    'SUB': 'subdivision',
    'PAR': 'paragraph',
    'CL': 'clause'
  };
  
  return knownPrefixes[prefix] || 'section';
}

// Returns: Array of {index, header, part, chapter, section, raw}
function extractSectionHeaders(lines: string[]): Array<{
  index: number;
  header: string;
  format: string;
  part?: string;
  chapter?: string;
  section?: string;
  article?: string;
  raw: string;
  levels?: Record<string, string>; // New field for arbitrary levels
}> {
  const result: Array<{
    index: number;
    header: string;
    format: string;
    part?: string;
    chapter?: string;
    section?: string;
    article?: string;
    raw: string;
    levels?: Record<string, string>;
  }> = [];
  for (let i = 0; i < lines.length; ++i) {
    const norm = normalize(lines[i]);
    
    // Standard P-C-S format
    const pcsMatch = /^P(\d+)-C(\d+)-S(\d+)$/.exec(norm);
    if (pcsMatch) {
      result.push({
        index: i,
        header: norm,
        format: 'pcs',
        part: pcsMatch[1],
        chapter: pcsMatch[2],
        section: pcsMatch[3],
        raw: lines[i],
        levels: {
          part: pcsMatch[1],
          chapter: pcsMatch[2],
          section: pcsMatch[3]
        }
      });
      continue;
    }
    
    // P-S format (Part-Section)
    const psMatch = /^P(\d+)-S(\d+)$/.exec(norm);
    if (psMatch) {
      result.push({
        index: i,
        header: norm,
        format: 'ps',
        part: psMatch[1],
        section: psMatch[2],
        raw: lines[i],
        levels: {
          part: psMatch[1],
          section: psMatch[2]
        }
      });
      continue;
    }
    
    // C-S format (Chapter-Section)
    const csMatch = /^C(\d+)-S(\d+)$/.exec(norm);
    if (csMatch) {
      result.push({
        index: i,
        header: norm,
        format: 'cs',
        chapter: csMatch[1],
        section: csMatch[2],
        raw: lines[i],
        levels: {
          chapter: csMatch[1],
          section: csMatch[2]
        }
      });
      continue;
    }
    
    // Article format (common in legal documents)
    const articleMatch = /^ART(\d+)$/.exec(norm);
    if (articleMatch) {
      result.push({
        index: i,
        header: norm,
        format: 'article',
        article: articleMatch[1],
        raw: lines[i],
        levels: {
          article: articleMatch[1]
        }
      });
      continue;
    }
    
    // Section only format
    const sectionOnlyMatch = /^S(\d+)$/.exec(norm);
    if (sectionOnlyMatch) {
      result.push({
        index: i,
        header: norm,
        format: 'section',
        section: sectionOnlyMatch[1],
        raw: lines[i],
        levels: {
          section: sectionOnlyMatch[1]
        }
      });
      continue;
    }
    
    // Generic pattern for arbitrary hierarchical structures
    // Matches patterns like A1-B2-C3, TITLE1-CHAPTER2-SECTION3, etc.
    const genericMatch = /^([A-Za-z]+\d+)(-[A-Za-z]+\d+)*$/.exec(norm);
    if (genericMatch) {
      const parts = norm.split('-');
      const levels: Record<string, string> = {};
      let format = '';
      
      for (const part of parts) {
        const levelMatch = part.match(/^([A-Za-z]+)(\d+)$/);
        if (levelMatch) {
          const [, prefix, number] = levelMatch;
          const levelType = inferLevelTypeFromPrefix(prefix);
          levels[levelType] = number;
          format += (format ? '-' : '') + levelType;
        }
      }
      
      if (Object.keys(levels).length > 0) {
        result.push({
          index: i,
          header: norm,
          format,
          raw: lines[i],
          levels
        });
      }
    }
  }
  
  if (DEBUG && result.length > 0) {
    console.log(`[TextExtractor] Found ${result.length} section headers with various formats`);
  }
  
  return result;
}

// Define a Section type to be used throughout the file
type Section = {
  index: number;
  header: string;
  format: string;
  part?: string;
  chapter?: string;
  section?: string;
  article?: string;
  raw: string;
  start?: number;
  end?: number;
  content?: string;
  levels?: Record<string, string>; // Add levels for arbitrary structures
};

// Expand all sections to full chapters and parts
// Input: text (string), docSections (objects with indexes and headers)
function expandSectionsToFullChapters(text: string, docSections: Array<ReturnType<typeof extractSectionHeaders>[0]>): Array<Section> {
  const lines = text.split('\n');
  const result: Array<Section> = [];

  if (docSections.length === 0) {
    return [];
  }

  // Sort the sections by index
  docSections.sort((a, b) => a.index - b.index);

  // Determine document format and structure
  const documentFormat = docSections[0].format;
  const documentStructure = analyzeDocumentStructure(docSections.map(s => s.header));
  
  if (DEBUG) {
    console.log(`[TextExtractor] Detected document format: ${documentFormat}`);
    console.log(`[TextExtractor] Document structure:`, documentStructure);
  }

  for (let i = 0; i < docSections.length; ++i) {
    const currentSection = { ...docSections[i] };
    const nextSection = i < docSections.length - 1 ? docSections[i + 1] : null;

    const section: Section = {
      ...currentSection,
      start: currentSection.index + 1,
      end: nextSection ? nextSection.index - 1 : lines.length - 1
    };

    // Extract content for this section
    if (section.start !== undefined && section.end !== undefined && section.start <= section.end) {
      section.content = lines.slice(section.start, section.end + 1).join('\n');
    } else {
      section.content = '';
    }

    result.push(section);
  }

  return result;
}

// Extract sections from text, optionally forcing certain patterns (strict matching)
function extractSectionsFromText(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options?: { debug?: boolean }
): { sections: Section[], structure: DocumentStructureInfo } {
  try {
    const lines = text.split('\n');
    const docSections = extractSectionHeaders(lines);

    if (DEBUG) {
      console.log(`[TextExtractor] Found ${docSections.length} section headers`);
      
      if (docSections.length > 0) {
        const formats = new Set(docSections.map(section => section.format));
        console.log(`[TextExtractor] Document format types: ${Array.from(formats).join(', ')}`);
      }
    }

    if (docSections.length === 0) {
      return { 
        sections: [],
        structure: {
          format: 'unknown',
          levels: ['section'],
          levelSeparator: '-',
          levelPrefixes: { section: 'S' }
        }
      };
    }

    // Analyze the document structure
    const structure = analyzeDocumentStructure(docSections.map(s => s.header));
    
    // Expand sections with content
    const sections = expandSectionsToFullChapters(text, docSections);
    
    return { sections, structure };
  } catch (error: unknown) {
    console.error("[TextExtractor] Error extracting sections:", error);
    return { 
      sections: [],
      structure: {
        format: 'unknown',
        levels: ['section'],
        levelSeparator: '-',
        levelPrefixes: { section: 'S' }
      }
    };
  }
}

export async function processAssistantText(
  input: TextExtractorInput
): Promise<TextExtractorOutput> {
  if (!input.toggleExtract) {
    if (DEBUG) console.log(`${logPrefix} Toggle OFF, returning as-is.`);
    return { extractedText: input.assistantText };
  }
  try {
    let jsonMsg: Record<string, unknown>;
    try {
      jsonMsg = robustJsonParse(input.assistantText);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.log('[TextExtractor] ERROR: Assistant output is not valid JSON.');
      throw new Error(
        "Assistant output is not valid JSON or cannot be parsed robustly. Got: " +
        input.assistantText
      );
    }
    let docName: string = (jsonMsg.doc_name as string || "").trim();
    if (!docName.endsWith('.txt')) docName += '.txt';
    const docSections: string[] = Array.isArray(jsonMsg.relevant_sections)
      ? (jsonMsg.relevant_sections as unknown[]).map((s) => String(s).trim())
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
    // Use cached file list to check existence, then download
    const lawFilesSet = await lawFilesPromise;
    if (!lawFilesSet.has(docName)) {
      console.log(`[TextExtractor] ERROR: File does NOT exist in bucket: ${docName}`);
      throw new Error(`Document not found in bucket: ${docName}`);
    }
    const [fileContents] = await lawBucket.file(docName).download();
    const fullText = fileContents.toString("utf8");
    
    // Extract sections and detect structure
    const { sections, structure } = extractSectionsFromText(fullText);
    
    // Filter sections based on the requested docSections
    const sectionsFound: string[] = [];
    const notFound: string[] = [...docSections];
    let extracted = '';
    
    // Process each section to see if it matches what we're looking for
    for (const section of sections) {
      const sectionId = section.header;
      const matchIndex = notFound.indexOf(sectionId);
      
      if (matchIndex !== -1) {
        sectionsFound.push(sectionId);
        notFound.splice(matchIndex, 1);
        
        if (section.content) {
          extracted += `\n\n${section.raw}\n${section.content}`;
        }
      }
    }
    
    if (DEBUG) {
      console.log(`[TextExtractor] Extraction complete for file: ${docName}`);
      console.log(`[TextExtractor] Sections found:`, sectionsFound);
      if (notFound.length) console.log(`[TextExtractor] Sections not found:`, notFound);
      console.log(`[TextExtractor] ----- EXTRACTED PREVIEW -----\n${extracted.slice(0, 500)}\n---------------------------`);
    }
    
    // Add document name at the beginning of the output for parsing
    const documentHeader = `Document: ${docName.replace('.txt', '')}\n\n`;
    
    // Include structure metadata in the output
    return {
      extractedText: documentHeader + extracted,
      filesUsed: [docName, ...sectionsFound],
      detectedStructure: structure // Include the detected structure
    };
  } catch (err) {
    console.log(`[TextExtractor] [FATAL ERROR]: ${err}`);
    return {
      extractedText: `[Error extracting: ${(err as Error)?.message}]`,
    };
  }
}