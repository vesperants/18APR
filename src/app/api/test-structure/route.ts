import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/services/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

interface TestStructureRequest {
  uid: string;
  conversationId: string;
}

/**
 * POST endpoint to test the new structure for tool calls and sections
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { uid, conversationId } = await req.json() as TestStructureRequest;
    
    if (!uid || !conversationId) {
      return NextResponse.json({
        error: 'Missing required fields (uid, conversationId)'
      }, { status: 400 });
    }
    
    console.log(`[TEST] Testing new structure for conversation: ${conversationId}`);
    
    // Create a conversation if it doesn't exist
    const convoRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId);
    
    const convoDoc = await convoRef.get();
    if (!convoDoc.exists) {
      await convoRef.set({
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        convoToolCalls: 0,
        title: "Test Conversation",
        isActive: true
      });
      console.log(`[TEST] Created new conversation: ${conversationId}`);
    }
    
    // Create a unique toolCallId
    const toolCallId = `test-${Date.now()}`;
    console.log(`[TEST] Created tool call ID: ${toolCallId}`);
    
    // Create a batch operation
    const batch = adminDb.batch();
    
    // Create the tool call document
    const toolCallRef = convoRef.collection("toolCalls").doc(toolCallId);
    batch.set(toolCallRef, {
      key: "Test search query",
      content: "This is test content with multiple sections\n---- [P5-C10-S591] ----\nSection: First test section\nThis is section 591 content\n\n---- [P5-C10-S592] ----\nSection: Second test section\nThis is section 592 content",
      createdAt: Timestamp.now(),
      hasExtractedSections: true,
      sectionsCount: 2,
      sectionIds: ["P5-C10-S591", "P5-C10-S592"]
    });
    
    // Create sections within the tool call
    const section1Ref = toolCallRef.collection("sections").doc("P5-C10-S591");
    const section2Ref = toolCallRef.collection("sections").doc("P5-C10-S592");
    
    batch.set(section1Ref, {
      title: "First test section",
      content: "This is section 591 content",
      createdAt: Timestamp.now()
    });
    
    batch.set(section2Ref, {
      title: "Second test section",
      content: "This is section 592 content",
      createdAt: Timestamp.now()
    });
    
    // Also create in the flat structure for backward compatibility
    const lawSection1Ref = convoRef.collection("lawSections").doc("P5-C10-S591");
    const lawSection2Ref = convoRef.collection("lawSections").doc("P5-C10-S592");
    
    batch.set(lawSection1Ref, {
      title: "First test section",
      content: "This is section 591 content",
      toolCallId,
      createdAt: Timestamp.now()
    });
    
    batch.set(lawSection2Ref, {
      title: "Second test section",
      content: "This is section 592 content",
      toolCallId,
      createdAt: Timestamp.now()
    });
    
    // Commit the batch
    console.log(`[TEST] Committing batch with test data`);
    await batch.commit();
    console.log(`[TEST] Batch committed successfully`);
    
    return NextResponse.json({ 
      success: true, 
      toolCallId,
      message: "Test data created successfully"
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