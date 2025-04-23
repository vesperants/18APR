import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/admin';

/**
 * GET endpoint for retrieving content for a specific node
 * /api/node-content?uid=...&conversationId=...&toolCallId=...&nodeId=...
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Get query parameters
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');
    const conversationId = url.searchParams.get('conversationId');
    const toolCallId = url.searchParams.get('toolCallId');
    const nodeId = url.searchParams.get('nodeId');
    
    // Validate required fields
    if (!uid || !conversationId || !toolCallId || !nodeId) {
      return NextResponse.json(
        { error: 'Missing required fields (uid, conversationId, toolCallId, nodeId)' },
        { status: 400 }
      );
    }
    
    console.log(`Retrieving content for node: ${nodeId}`);
    
    // Get the node document
    const nodeDoc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("nodes")
      .doc(nodeId)
      .get();
    
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
      metadata: nodeData?.metadata || {}
    });
    
  } catch (error) {
    console.error('Error retrieving node content:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve node content' },
      { status: 500 }
    );
  }
} 