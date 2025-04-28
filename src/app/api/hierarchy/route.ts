import { NextRequest, NextResponse } from 'next/server';
import { getFlexibleHierarchy } from '@/lib/search-engine/hierarchyStore';
import { adminDb } from '@/services/firebase/admin';

/**
 * GET endpoint for retrieving a flexible hierarchical structure
 * /api/hierarchy?uid=...&conversationId=...&toolCallId=...
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
    
    console.log(`Retrieving flexible hierarchy for tool call: ${toolCallId}`);
    
    // Get flexible hierarchy for the tool call
    const hierarchy = await getFlexibleHierarchy(
      uid, 
      conversationId, 
      toolCallId,
      "I've found relevant document sections for your query."
    );
    
    return NextResponse.json(hierarchy);
    
  } catch (error) {
    console.error('Error retrieving flexible hierarchy:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve hierarchical structure' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for retrieving specific node content
 * Body: { uid, conversationId, toolCallId, nodeId }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Get request body
    const body = await req.json();
    const { uid, conversationId, toolCallId, nodeId, documentId } = body;
    
    // Validate required fields
    if (!uid || !conversationId || !toolCallId || !nodeId) {
      return NextResponse.json(
        { error: 'Missing required fields (uid, conversationId, toolCallId, nodeId)' },
        { status: 400 }
      );
    }
    
    console.log(`Retrieving content for node: ${nodeId}`);
    
    // Get the collection path based on whether documentId is provided
    let nodeRef;
    
    if (documentId) {
      // If documentId is provided, look in the hierarchy structure
      nodeRef = adminDb
        .collection("users")
        .doc(uid)
        .collection("conversations")
        .doc(conversationId)
        .collection("toolCalls")
        .doc(toolCallId)
        .collection("hierarchy")
        .doc(documentId)
        .collection("nodes")
        .doc(nodeId);
    } else {
      // Otherwise look in the flat nodes collection
      nodeRef = adminDb
        .collection("users")
        .doc(uid)
        .collection("conversations")
        .doc(conversationId)
        .collection("toolCalls")
        .doc(toolCallId)
        .collection("nodes")
        .doc(nodeId);
    }
    
    const nodeDoc = await nodeRef.get();
    
    if (!nodeDoc.exists) {
      return NextResponse.json(
        { error: `Node not found: ${nodeId}` },
        { status: 404 }
      );
    }
    
    const nodeData = nodeDoc.data();
    
    return NextResponse.json({
      nodeId,
      nodeType: nodeData?.nodeType || 'unknown',
      nodeTitle: nodeData?.nodeTitle || nodeId,
      content: nodeData?.content || '',
      metadata: nodeData?.metadata || {},
      hierarchyPath: nodeData?.hierarchyPath || [nodeId],
      children: nodeData?.children || []
    });
    
  } catch (error) {
    console.error('Error retrieving node content:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve node content' },
      { status: 500 }
    );
  }
} 