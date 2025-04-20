import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/services/firebase/admin";

// Define types for clarity
interface ToolCall {
  id: string;
  createdAt: Date;
  data: Record<string, any>;
}

interface Section {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  createdAt: Date;
  hasToolCallId: boolean;
  data: Record<string, any>;
}

/**
 * POST endpoint to migrate existing lawSections by adding toolCallId field
 * This will associate sections with their tool calls based on timestamps
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { uid, conversationId } = await req.json();
    
    if (!uid || !conversationId) {
      return NextResponse.json({
        error: 'Missing required fields (uid, conversationId)'
      }, { status: 400 });
    }
    
    console.log(`[MIGRATE] Starting migration for conversation: ${conversationId}`);
    
    // 1. Get all tool calls for the conversation
    const toolCallsSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .orderBy("createdAt", "asc")
      .get();
    
    if (toolCallsSnapshot.empty) {
      return NextResponse.json({
        message: "No tool calls found to migrate",
        success: true,
        migratedSections: 0
      });
    }
    
    // Map tool calls by timestamp for later matching
    const toolCalls: ToolCall[] = toolCallsSnapshot.docs.map(doc => ({
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate() || new Date(0),
      data: doc.data()
    }));
    
    console.log(`[MIGRATE] Found ${toolCalls.length} tool calls to process`);
    
    // 2. Get all sections without toolCallId
    const sectionsSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("lawSections")
      .get();
    
    if (sectionsSnapshot.empty) {
      return NextResponse.json({
        message: "No sections found to migrate",
        success: true,
        migratedSections: 0
      });
    }
    
    const sections: Section[] = sectionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ref: doc.ref,
      createdAt: doc.data().createdAt?.toDate() || new Date(0),
      hasToolCallId: !!doc.data().toolCallId,
      data: doc.data()
    }));
    
    // Filter out sections that already have toolCallId
    const sectionsToMigrate = sections.filter(s => !s.hasToolCallId);
    
    console.log(`[MIGRATE] Found ${sectionsToMigrate.length} sections without toolCallId`);
    
    if (sectionsToMigrate.length === 0) {
      return NextResponse.json({
        message: "All sections already have toolCallId",
        success: true,
        migratedSections: 0
      });
    }
    
    // 3. Associate sections with tool calls based on timestamps
    // Create batches (Firestore has a limit of 500 operations per batch)
    const batchSize = 400;
    const batches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = adminDb.batch();
    let operationCount = 0;
    let totalMigrated = 0;
    
    // Create a default fallback toolCallId using the most recent tool call
    const fallbackToolCallId = toolCalls.length > 0 ? 
      toolCalls[toolCalls.length - 1].id : 
      `migration-fallback-${Date.now()}`;
    
    for (const section of sectionsToMigrate) {
      // Find the tool call created closest before this section
      // This assumes sections are created shortly after the tool call that generated them
      let matchingToolCall: ToolCall | null = null;
      
      // If section has createdAt, use timestamp matching
      if (section.createdAt instanceof Date && section.createdAt.getTime() > 0) {
        // Find the most recent tool call created before this section
        for (let i = toolCalls.length - 1; i >= 0; i--) {
          if (toolCalls[i].createdAt <= section.createdAt) {
            matchingToolCall = toolCalls[i];
            break;
          }
        }
      }
      
      // Use the matching tool call or fallback
      const toolCallId = matchingToolCall ? matchingToolCall.id : fallbackToolCallId;
      
      // Update the section
      currentBatch.update(section.ref, { 
        toolCallId,
        migratedAt: new Date()
      });
      
      // Also create a copy in the nested structure
      if (matchingToolCall) {
        const nestedSectionRef = adminDb
          .collection("users")
          .doc(uid)
          .collection("conversations")
          .doc(conversationId)
          .collection("toolCalls")
          .doc(toolCallId)
          .collection("sections")
          .doc(section.id);
          
        currentBatch.set(nestedSectionRef, {
          ...section.data,
          toolCallId,
          migratedAt: new Date()
        });
        
        operationCount++; // Count the extra operation
      }
      
      operationCount++;
      totalMigrated++;
      
      // If we're approaching the batch limit, commit and start a new batch
      if (operationCount >= batchSize) {
        batches.push(currentBatch);
        currentBatch = adminDb.batch();
        operationCount = 0;
      }
    }
    
    // Add the final batch if it has operations
    if (operationCount > 0) {
      batches.push(currentBatch);
    }
    
    // 4. Commit all batches
    console.log(`[MIGRATE] Committing ${batches.length} batches with ${totalMigrated} sections`);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`[MIGRATE] Committing batch ${i+1}/${batches.length}`);
      await batches[i].commit();
    }
    
    // 5. Update tool calls with section information
    const updateToolCallsBatch = adminDb.batch();
    let toolCallUpdateCount = 0;
    
    // Group migrated sections by tool call ID
    const sectionsByToolCall: Record<string, string[]> = {};
    for (const section of sectionsToMigrate) {
      const tcId = section.data.toolCallId || fallbackToolCallId;
      if (!sectionsByToolCall[tcId]) {
        sectionsByToolCall[tcId] = [];
      }
      sectionsByToolCall[tcId].push(section.id);
    }
    
    // Update each tool call with its sections
    for (const [tcId, sectionIds] of Object.entries(sectionsByToolCall)) {
      const toolCallRef = adminDb
        .collection("users")
        .doc(uid)
        .collection("conversations")
        .doc(conversationId)
        .collection("toolCalls")
        .doc(tcId);
      
      updateToolCallsBatch.update(toolCallRef, {
        hasExtractedSections: true,
        sectionsCount: sectionIds.length,
        sectionIds: sectionIds,
        updatedByMigration: true
      });
      
      toolCallUpdateCount++;
    }
    
    if (toolCallUpdateCount > 0) {
      console.log(`[MIGRATE] Updating ${toolCallUpdateCount} tool calls with section info`);
      await updateToolCallsBatch.commit();
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${totalMigrated} sections`,
      migratedSections: totalMigrated,
      batches: batches.length
    });
    
  } catch (error) {
    console.error("[MIGRATE] Migration failed", error);
    return NextResponse.json({ 
      error: "Migration failed", 
      errorMessage: String(error),
      success: false 
    }, { status: 500 });
  }
} 