import { NextRequest, NextResponse } from 'next/server';
import { getToolCallsForConversation } from '@/lib/search-engine/toolCallStore';

/**
 * Parses the content of a legal search result into structured sections
 * based on PCS (Part-Chapter-Section) identifiers.
 * 
 * @param content The full text content with multiple sections
 * @returns An object with PCS identifiers as keys and section data as values
 */
function parseContentSections(content: string) {
  const sections: Record<string, { title: string, content: string }> = {};
  const sectionPattern = /---- \[(P\d+-C\d+-S\d+)\] ----([^-]*?)(?=---- \[|$)/g;
  
  let match;
  while ((match = sectionPattern.exec(content)) !== null) {
    const pcsId = match[1];
    const sectionContent = match[2].trim();
    
    // Extract section title
    const titleMatch = sectionContent.match(/Section: ([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    sections[pcsId] = {
      title: title,
      content: sectionContent
    };
  }
  
  return sections;
}

/**
 * POST endpoint to test PCS section parsing
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { content } = await req.json();
    
    if (!content) {
      return NextResponse.json(
        { error: 'Missing content in request body' },
        { status: 400 }
      );
    }
    
    const parsedSections = parseContentSections(content);
    
    return NextResponse.json({
      sections: parsedSections,
      count: Object.keys(parsedSections).length,
      success: true
    });
    
  } catch (error) {
    console.error('Error parsing content:', error);
    return NextResponse.json(
      { error: 'Failed to parse content', success: false },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const uid = searchParams.get('uid');
    const conversationId = searchParams.get('conversationId');
    
    if (!uid || !conversationId) {
      return NextResponse.json({
        error: 'Missing required parameters (uid, conversationId)'
      }, { status: 400 });
    }
    
    const toolCalls = await getToolCallsForConversation(uid, conversationId);
    
    return NextResponse.json({ 
      success: true, 
      toolCalls
    });
  } catch (error) {
    console.error(`[ListToolCalls] Error:`, error);
    return NextResponse.json({ 
      error: "Failed to list tool calls", 
      errorMessage: String(error),
      success: false 
    }, { status: 500 });
  }
} 