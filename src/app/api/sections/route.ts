import { NextRequest, NextResponse } from 'next/server';
import { getAllSectionsContent, getHierarchicalSectionTitles } from '@/lib/search-engine';

/**
 * GET endpoint for retrieving section titles
 * /api/sections?uid=...&conversationId=...&toolCallId=...
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
    
    console.log(`Retrieving hierarchical section titles for tool call: ${toolCallId}`);
    
    // Get hierarchical section titles for the tool call
    const hierarchicalTitles = await getHierarchicalSectionTitles(
      uid, 
      conversationId, 
      toolCallId,
      "I've found several relevant legal sections that may apply to your query."
    );
    
    return NextResponse.json(hierarchicalTitles);
    
  } catch (error) {
    console.error('Error retrieving section titles:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve section titles' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for preloading all section contents
 * /api/sections
 * Body: { uid, conversationId, toolCallId }
 * 
 * Returns the actual section contents in the response for immediate use
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Get request body
    const body = await req.json();
    const { uid, conversationId, toolCallId } = body;
    
    // Validate required fields
    if (!uid || !conversationId || !toolCallId) {
      return NextResponse.json(
        { error: 'Missing required fields (uid, conversationId, toolCallId)' },
        { status: 400 }
      );
    }
    
    console.log(`Preloading all section contents for tool call: ${toolCallId}`);
    
    // Get all section contents in parallel
    const contents = await getAllSectionsContent(uid, conversationId, toolCallId);
    
    return NextResponse.json({
      success: true,
      count: Object.keys(contents).length,
      sectionsLoaded: Object.keys(contents),
      // Return the actual contents for immediate use in the client
      contents: contents
    });
    
  } catch (error) {
    console.error('Error preloading section contents:', error);
    return NextResponse.json(
      { error: 'Failed to preload section contents' },
      { status: 500 }
    );
  }
} 