import { NextRequest, NextResponse } from 'next/server';
import { 
  getFlexibleHierarchy
} from '@/lib/search-engine';

/**
 * POST endpoint for generating a structured response format
 * /api/structured-response
 * Body: { uid, conversationId, toolCallId, query }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Get request body
    const body = await req.json();
    const { uid, conversationId, toolCallId, query } = body;
    
    // Validate required fields
    if (!uid || !conversationId || !toolCallId) {
      return NextResponse.json(
        { error: 'Missing required fields (uid, conversationId, toolCallId)' },
        { status: 400 }
      );
    }
    
    console.log(`Generating hierarchical response for tool call: ${toolCallId}`);
    
    // Get flexible hierarchy directly
    const message = `I've found relevant legal sections related to ${query && query.substring(0, 50)}...`;
    const hierarchicalResponse = await getFlexibleHierarchy(
      uid, 
      conversationId, 
      toolCallId,
      message
    );
    
    // Return hierarchical response directly
    return NextResponse.json(hierarchicalResponse);
    
  } catch (error) {
    console.error('Error generating hierarchical response:', error);
    return NextResponse.json(
      { error: 'Failed to generate hierarchical response' },
      { status: 500 }
    );
  }
} 