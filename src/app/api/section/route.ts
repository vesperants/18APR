import { NextRequest, NextResponse } from 'next/server';
import { retrieveSectionText } from '@/lib/search-engine/toolCallStore';
import { adminDb } from "@/services/firebase/admin";

interface SectionRequest {
  uid: string;
  conversationId: string;
  toolCallId: string; // Can be a specific ID or "latest"
  sectionId: string;
}

/**
 * Gets the latest toolCall id for a conversation
 */
async function getLatestToolCallId(uid: string, conversationId: string): Promise<string | null> {
  try {
    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].id;
  } catch (error) {
    console.error("Error getting latest toolCall:", error);
    return null;
  }
}

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
    
    // Handle "latest" toolCallId case
    let actualToolCallId = toolCallId;
    if (toolCallId === "latest") {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error retrieving section:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
} 