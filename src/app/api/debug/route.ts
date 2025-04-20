import { NextRequest, NextResponse } from 'next/server';
import { getLawSectionsStats, testParseSections } from '@/lib/search-engine/debug';

/**
 * Endpoint to check if parsing and storage are working
 * GET /api/debug?uid=...&conversationId=...
 * POST /api/debug - with content to test parsing
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');
    const conversationId = url.searchParams.get('conversationId');

    if (!uid || !conversationId) {
      return NextResponse.json({
        error: 'Missing required parameters: uid and conversationId'
      }, { status: 400 });
    }

    // Check if lawSections collection exists and get stats
    const stats = await getLawSectionsStats(uid, conversationId);

    return NextResponse.json({
      stats,
      success: true
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: 'Debug check failed',
      errorMessage: String(error),
      success: false
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { content } = await req.json();
    
    if (!content) {
      return NextResponse.json({
        error: 'Missing content in request body'
      }, { status: 400 });
    }

    // Test parsing the content
    const result = testParseSections(content);

    return NextResponse.json({
      result,
      success: true
    });
  } catch (error) {
    console.error('Debug parsing error:', error);
    return NextResponse.json({
      error: 'Failed to parse content',
      errorMessage: String(error),
      success: false
    }, { status: 500 });
  }
} 