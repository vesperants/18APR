import { adminDb } from '@/services/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import {
  HierarchyNode,
  DocumentHierarchy,
  FlexibleHierarchicalResponse
} from "./types";

/**
 * Retrieves flexible hierarchical structure of nodes
 */
export async function getFlexibleHierarchy(
  uid: string,
  conversationId: string,
  toolCallId: string,
  message: string = "I've found relevant document sections."
): Promise<FlexibleHierarchicalResponse> {
  try {
    console.log(`[DEBUG] Getting flexible hierarchy for toolCall: ${toolCallId}`);

    // Fetch the hierarchy collection once
    const hierarchyRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("toolCalls")
      .doc(toolCallId)
      .collection("hierarchy");
    const hierarchySnapshot = await hierarchyRef.get();
    
    // Return empty if no hierarchy found
    if (hierarchySnapshot.empty) {
      console.log(`[DEBUG] No hierarchy found for toolCall: ${toolCallId}`);
      return { messageId: `msg_${uuidv4().split('-')[0]}`, conversationId, toolCallId, message, documents: [] };
    }

    // Process hierarchical documents
    const documents: DocumentHierarchy[] = [];
    
    // Iterate through each document in the hierarchy
    for (const docSnapshot of hierarchySnapshot.docs) {
      const docData = docSnapshot.data();
      
      // Get the nodes for this document
      const nodesSnapshot = await docSnapshot.ref.collection("nodes").get();
      
      if (nodesSnapshot.empty) {
        console.log(`[DEBUG] No nodes found for document: ${docSnapshot.id}`);
        continue;
      }
      
      const nodes: Record<string, HierarchyNode> = {};
      const rootNodeIds: string[] = [];
      
      // First pass: create all nodes
      nodesSnapshot.docs.forEach(nodeDoc => {
        const nodeData = nodeDoc.data();
        nodes[nodeDoc.id] = {
          nodeId: nodeDoc.id,
          nodeType: nodeData.nodeType || 'section',
          nodeTitle: nodeData.nodeTitle || nodeDoc.id,
          content: nodeData.content,
          metadata: nodeData.metadata || {},
          children: []
        };
        
        // Check if this is a root node
        const hierarchyPath = nodeData.hierarchyPath || [nodeDoc.id];
        if (hierarchyPath.length <= 1) {
          rootNodeIds.push(nodeDoc.id);
        }
      });
      
      // Second pass: build the hierarchy
      nodesSnapshot.docs.forEach(nodeDoc => {
        const nodeData = nodeDoc.data();
        const hierarchyPath = nodeData.hierarchyPath || [nodeDoc.id];
        
        if (hierarchyPath.length > 1) {
          // Has parent
          const parentId = hierarchyPath[hierarchyPath.length - 2];
          if (nodes[parentId]) {
            nodes[parentId].children = nodes[parentId].children || [];
            nodes[parentId].children.push(nodes[nodeDoc.id]);
          } else {
            // Parent not found, make it a root node
            rootNodeIds.push(nodeDoc.id);
          }
        }
      });
      
      // Create the document hierarchy
      documents.push({
        documentId: docSnapshot.id,
        documentTitle: docData.documentTitle || docSnapshot.id,
        documentStructure: docData.documentStructure,
        nodes: rootNodeIds.map(id => nodes[id])
      });
    }
    
    console.log(`[DEBUG] Retrieved ${documents.length} documents with hierarchical structure`);
    
    return {
      messageId: `msg_${uuidv4().split('-')[0]}`,
      conversationId,
      toolCallId,
      message,
      documents
    };
  } catch (error) {
    console.error(`Error building flexible hierarchy for toolCall ${toolCallId}:`, error);
    
    // Return empty response in case of error
    return {
      messageId: `msg_${uuidv4().split('-')[0]}`,
      conversationId,
      toolCallId,
      message: "Error retrieving document structure.",
      documents: []
    };
  }
} 