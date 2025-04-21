import { NextRequest, NextResponse } from 'next/server';
// Ensure Firebase Admin SDK is initialized
import '@/services/firebase/admin';
import { getSectionsForToolCall } from '@/lib/search-engine/toolCallStore';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const uid = searchParams.get('uid');
    const conversationId = searchParams.get('conversationId');
    const toolCallId = searchParams.get('toolCallId');
    
    if (!uid || !conversationId || !toolCallId) {
      return NextResponse.json({
        error: 'Missing required parameters (uid, conversationId, toolCallId)'
      }, { status: 400 });
    }
    
    const sections = await getSectionsForToolCall(uid, conversationId, toolCallId);
    
    return NextResponse.json({ 
      success: true, 
      sections
    });
  } catch (error) {
    console.error(`[GetSections] Error:`, error);
    return NextResponse.json({ 
      error: "Failed to get sections", 
      errorMessage: String(error),
      success: false 
    }, { status: 500 });
  }
} 