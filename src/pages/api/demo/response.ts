import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

/**
 * API demo endpoint that returns a sample hierarchical response
 * This is for testing the hierarchical response format
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Create a mock tool call ID
  const toolCallId = uuidv4();
  
  // Sample query
  const userQuery = "What are the laws for bribery and government fraud?";
  
  // Create a hierarchical response structure
  const hierarchicalResponse = {
    messageId: `msg_${uuidv4().split('-')[0]}`,
    conversationId: "demo",
    toolCallId,
    message: "Here are the laws related to bribery and government fraud.",
    metadata: {
      query: userQuery,
      timestamp: new Date().toISOString()
    },
    documents: [
      {
        documentId: "CriminalCode",
        documentTitle: "Criminal Code",
        documentStructure: {
          format: "pcs",
          levels: ["part", "chapter", "section"],
          levelSeparator: "-",
          levelPrefixes: { part: "P", chapter: "C", section: "S" }
        },
        nodes: [
          {
            nodeId: "P3-C4",
            nodeType: "chapter",
            nodeTitle: "Corruption and Public Office",
            children: [
              {
                nodeId: "P3-C4-S12",
                nodeType: "section",
                nodeTitle: "Bribery of Public Officials",
                content: "Any person who directly or indirectly gives, offers, or promises anything of value to a public official with intent to influence that official's actions, opinions, or judgments on any matter before them in their official capacity, commits the offense of bribery.\n\nPenalties:\n- First offense: Fine up to $10,000 and/or imprisonment for up to 5 years\n- Subsequent offenses: Fine up to $25,000 and/or imprisonment for up to 10 years\n\nNotes: Both the person offering the bribe and the public official accepting it shall be equally guilty of the offense."
              },
              {
                nodeId: "P3-C4-S13",
                nodeType: "section",
                nodeTitle: "Fraud Against the Government",
                content: "Any person who knowingly makes, uses, or causes to be made or used, a false record or statement to get a false or fraudulent claim paid or approved by the government commits fraud against the government.\n\nElements of the offense:\n1. Knowingly presenting false information\n2. With the purpose of obtaining government funds or approval\n3. Resulting in actual or potential financial loss to the government\n\nPenalties:\n- Civil penalty of $5,000 to $10,000 per violation\n- Three times the amount of damages sustained by the government\n- Criminal penalties may also apply under relevant statutes"
              }
            ]
          }
        ]
      }
    ]
  };
  
  // Log the response (this will appear in the server logs)
  console.log("HIERARCHICAL RESPONSE:", JSON.stringify(hierarchicalResponse, null, 2));
  
  // Set CORS headers to allow frontend to access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Return the hierarchical response
  return res.status(200).json(hierarchicalResponse);
} 