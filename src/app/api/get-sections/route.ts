import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSectionsForToolCall } from '@/lib/search-engine';

/**
 * GET endpoint for retrieving full section contents
 * /api/get-sections?uid=...&conversationId=...&toolCallId=...
 * 
 * Returns sections with their contents in a hierarchical structure
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Get query parameters
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');
    const conversationId = url.searchParams.get('conversationId');
    const toolCallId = url.searchParams.get('toolCallId');
    
    // Validate required fields
    if (!uid || !conversationId || !toolCallId) {
      return NextResponse.json(
        { error: 'Missing required fields (uid, conversationId, toolCallId)' },
        { status: 400 }
      );
    }
    
    console.log(`Retrieving section contents for tool call: ${toolCallId}`);
    
    // Get all sections with their content
    const sections = await getSectionsForToolCall(uid, conversationId, toolCallId);
    
    if (!sections || sections.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No sections found"
      });
    }
    
    // Organize sections into a hierarchical structure
    const fileMap: Record<string, {
      fileId: string;
      title: string;
      documents: Record<string, {
        documentId: string;
        parts: Record<string, {
          partId: string;
          title: string;
          chapters: Record<string, {
            chapterId: string;
            title: string;
            sections: Array<{
              blockId: string;
              pcsId: string;
              title: string;
              content: string;
            }>;
          }>;
        }>;
      }>;
    }> = {};
    
    for (const section of sections) {
      const fileName = section.fileName || 'unknown_file';
      const pcsId = section.id;
      
      // Skip if not a PCS ID format
      if (!pcsId.match(/P\d+-C\d+-S\d+/)) continue;
      
      // Extract part, chapter, and section IDs from the PCS format
      const [, partNumber, chapterNumber] = pcsId.match(/P(\d+)-C(\d+)-S(\d+)/) || [];
      if (!partNumber || !chapterNumber) continue;
      
      const partId = `P${partNumber}`;
      const chapterId = `C${chapterNumber}`;
      const documentId = section.documentId || fileName.replace(/\.\w+$/, '');
      
      // Initialize fileMap entries if they don't exist
      if (!fileMap[fileName]) {
        fileMap[fileName] = {
          fileId: fileName,
          title: formatFileTitle(fileName),
          documents: {}
        };
      }
      
      if (!fileMap[fileName].documents[documentId]) {
        fileMap[fileName].documents[documentId] = {
          documentId,
          parts: {}
        };
      }
      
      if (!fileMap[fileName].documents[documentId].parts[partId]) {
        fileMap[fileName].documents[documentId].parts[partId] = {
          partId,
          title: section.partTitle || `Part ${partNumber}`,
          chapters: {}
        };
      }
      
      if (!fileMap[fileName].documents[documentId].parts[partId].chapters[chapterId]) {
        fileMap[fileName].documents[documentId].parts[partId].chapters[chapterId] = {
          chapterId,
          title: section.chapterTitle || `Chapter ${chapterNumber}`,
          sections: []
        };
      }
      
      // Add the section with its content
      fileMap[fileName].documents[documentId].parts[partId].chapters[chapterId].sections.push({
        blockId: `block_${uuidv4().split('-')[0]}`,
        pcsId,
        title: section.title,
        content: section.content
      });
    }
    
    // Convert the map to the hierarchical structure format
    const files = Object.values(fileMap).map(file => ({
      fileId: file.fileId,
      title: file.title,
      documents: Object.values(file.documents).map(doc => ({
        documentId: doc.documentId,
        parts: Object.values(doc.parts).map(part => ({
          partId: part.partId,
          title: part.title,
          chapters: Object.values(part.chapters).map(chapter => ({
            chapterId: chapter.chapterId,
            title: chapter.title,
            sections: chapter.sections
          }))
        }))
      }))
    }));
    
    return NextResponse.json({
      success: true,
      messageId: `msg_${uuidv4().split('-').join('').substring(0, 10)}`,
      conversationId,
      toolCallId,
      message: "Here are the complete section contents you requested.",
      files
    });
    
  } catch (error) {
    console.error('Error retrieving section contents:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve section contents', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper function to format file title from file name
 */
function formatFileTitle(fileName: string): string {
  // Remove file extension
  let title = fileName.replace(/\.\w+$/, '');
  
  // Replace underscores and hyphens with spaces
  title = title.replace(/[_-]/g, ' ');
  
  // Capitalize first letter of each word
  title = title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Handle special cases
  if (title.toLowerCase().includes('code')) {
    return title + ' Code';
  } else if (title.toLowerCase().includes('act') || title.toLowerCase().includes('law')) {
    return title + ' Act';
  }
  
  return title;
} 