import { NextRequest, NextResponse } from 'next/server';
import { retrieveSectionText, retrieveSectionTitles } from '@/lib/search-engine';
import { adminDb } from "@/services/firebase/admin";

interface SectionRequest {
  uid: string;
  conversationId: string;
  toolCallId?: string; // Optional - defaults to "latest"
  sectionId: string;
}

/**
 * Helper to get the latest tool call ID for a conversation
 */
async function getLatestToolCallId(uid: string, conversationId: string): Promise<string | null> {
  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("toolCalls")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
    
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/**
 * GET endpoint for retrieving section titles
 * /api/section?uid=...&conversationId=...
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Get query parameters
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');
    const conversationId = url.searchParams.get('conversationId');
    
    // Validate required fields
    if (!uid || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields (uid, conversationId)' },
        { status: 400 }
      );
    }
    
    console.log(`Retrieving section titles for conversation: ${conversationId}`);
    
    // Get all section titles for this conversation
    // retrieveSectionTitles expects a single object parameter
    const titles = await retrieveSectionTitles({ uid, conversationId });
    
    return NextResponse.json({
      titles,
      count: Object.keys(titles).length
    });
    
  } catch (error) {
    console.error('Error retrieving section titles:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve section titles' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for retrieving a specific section
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Parse request body
    const body: SectionRequest = await req.json();
    const { uid, conversationId, toolCallId, sectionId } = body;
    
    // Validate required fields
    if (!uid || !conversationId || !sectionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log(`Retrieving specific section: "${sectionId}"`);
    
    // Handle "latest" toolCallId case or no toolCallId provided
    let actualToolCallId = toolCallId;
    if (!toolCallId || toolCallId === "latest") {
      const latestId = await getLatestToolCallId(uid, conversationId);
      if (!latestId) {
        return NextResponse.json(
          { error: 'No toolCalls found for this conversation' },
          { status: 404 }
        );
      }
      actualToolCallId = latestId;
    }
    
    // Retrieve only the specific section text
    const sectionContent = await retrieveSectionText({
      uid,
      conversationId, 
      toolCallId: actualToolCallId,
      sectionId
    });
    
    if (!sectionContent) {
      console.error(`Section not found: "${sectionId}"`);
      return NextResponse.json(
        { error: `Section not found: "${sectionId}"` },
        { status: 404 }
      );
    }
    
    // Verify we only got a single section
    const hasPCS = /P\d+-C\d+-S\d+/.test(sectionContent);
    const hasMultiplePCS = (sectionContent.match(/P\d+-C\d+-S\d+/g) || []).length > 1;
    
    if (hasMultiplePCS) {
      console.warn(`Multiple section markers found in extracted content for: "${sectionId}"`);
      // Content will already be trimmed by retrieveSectionText, but log a warning
    }
    
    console.log(`Successfully retrieved section: "${sectionId}" (${sectionContent.length} chars, contains PCS marker: ${hasPCS})`);
    
    // Return just the specific section content
    return NextResponse.json({
      sectionId,
      content: sectionContent,
      toolCallId: actualToolCallId
    });
    
  } catch (error) {
    console.error('Error retrieving section:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve section' },
      { status: 500 }
    );
  }
} 