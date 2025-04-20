import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/services/firebase/admin";
import { simpleParseSections } from "@/lib/search-engine/debug";
import { Timestamp } from "firebase-admin/firestore";

interface TestSectionRequest {
  uid: string;
  conversationId: string;
  content: string;
}

/**
 * POST endpoint to test section parsing and storage
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { uid, conversationId, content } = await req.json() as TestSectionRequest;
    
    if (!uid || !conversationId || !content) {
      return NextResponse.json({
        error: 'Missing required fields (uid, conversationId, content)'
      }, { status: 400 });
    }
    
    console.log(`[TEST] Testing section storage for conversation: ${conversationId}`);
    console.log(`[TEST] Content received (first 100 chars): ${content.substring(0, 100)}...`);
    
    // Parse the sections using our simple method
    const parsingResult = simpleParseSections(content);
    console.log(`[TEST] Parsed ${parsingResult.count} sections: ${JSON.stringify(parsingResult.sectionIds)}`);
    
    // Debug information
    console.log(`[TEST] Debug info:`, parsingResult.debug);
    
    if (parsingResult.count === 0) {
      return NextResponse.json({ 
        error: "No sections parsed from content", 
        content: content.substring(0, 300) + "...",
        debug: parsingResult.debug,
        patternTest: {
          pcsMatch: content.match(/P\d+-C\d+-S\d+/g)?.slice(0, 3),
          markerMatch: content.match(/---- \[(P\d+-C\d+-S\d+)\] ----/g)?.slice(0, 3)
        },
        success: false 
      }, { status: 400 });
    }
    
    // Create a unique toolCallId
    const toolCallId = `test-${Date.now()}`;
    
    // Check if conversation exists
    const conversationRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId);
    
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      console.log(`[TEST] Conversation ${conversationId} does not exist, creating it`);
      await conversationRef.set({
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        convoToolCalls: 0
      });
    }
    
    // Start a batch operation
    const batch = adminDb.batch();
    
    // Reference to the conversation document
    const convoRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId);
    
    // Create the tool call document
    const toolCallRef = convoRef.collection("toolCalls").doc(toolCallId);
    batch.set(toolCallRef, {
      content,
      createdAt: Timestamp.now(),
      key: "Test content",
      processedSections: true,
      sectionsCount: parsingResult.count
    });
    
    // Store each section
    const sectionsRef = convoRef.collection("lawSections");
    console.log(`[TEST] Created lawSections reference at path: ${sectionsRef.path}`);
    
    for (const [pcsId, sectionData] of Object.entries(parsingResult.sections)) {
      console.log(`[TEST] Adding section ${pcsId} with title: ${sectionData.title}`);
      
      const sectionRef = sectionsRef.doc(pcsId);
      batch.set(sectionRef, {
        title: sectionData.title,
        content: sectionData.content,
        toolCallId,
        createdAt: Timestamp.now()
      });
    }
    
    // Commit the batch
    console.log(`[TEST] Committing batch with ${parsingResult.count} sections`);
    await batch.commit();
    console.log(`[TEST] Batch committed successfully`);
    
    return NextResponse.json({ 
      success: true, 
      toolCallId, 
      parsedSections: {
        count: parsingResult.count,
        sections: parsingResult.sectionIds
      }
    });
  } catch (error) {
    console.error("[TEST] Test failed", error);
    return NextResponse.json({ 
      error: "Test failed", 
      errorMessage: String(error),
      success: false 
    }, { status: 500 });
  }
} 