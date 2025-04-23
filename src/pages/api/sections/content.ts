import type { NextApiRequest, NextApiResponse } from 'next';
import { retrieveSectionText } from '@/lib/search-engine';
import { getAuth } from '@/lib/auth';

type ResponseData = {
  content: string;
  documentId?: string;
  title?: string;
} | {
  error: string;
};

/**
 * API endpoint to retrieve the content of a specific legal section
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user authentication data
    const auth = await getAuth(req);
    if (!auth.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract parameters from request body
    const { conversationId, toolCallId, sectionId, documentId } = req.body;
    
    if (!conversationId || !sectionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get the section content
    const sectionContent = await retrieveSectionText({
      uid: auth.user.id,
      conversationId,
      toolCallId,
      sectionId,
    });

    if (!sectionContent) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Extract title from section content
    const titleMatch = sectionContent.match(/Section:\s*([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Legal Section';

    // Return the section content and metadata
    return res.status(200).json({
      content: sectionContent,
      documentId: documentId || 'legal_code',
      title
    });
  } catch (error) {
    console.error('Error retrieving section content:', error);
    return res.status(500).json({ error: 'Failed to retrieve section content' });
  }
} 