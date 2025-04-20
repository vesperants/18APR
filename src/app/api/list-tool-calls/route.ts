import { NextRequest, NextResponse } from 'next/server';
import { getToolCallsForConversation } from '@/lib/search-engine/toolCallStore';

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