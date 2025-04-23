import React, { useState, useEffect } from 'react';
import { FlexibleHierarchicalResponse, HierarchyNode } from '@/lib/search-engine/types';

// Component to render hierarchy nodes recursively
function RenderHierarchyNodes({ nodes, level = 0 }: { 
  nodes: HierarchyNode[], 
  level?: number 
}) {
  // Calculate the padding class based on level
  const paddingClass = `pl-${Math.min(level * 2 + 4, 12)}`; // Cap at pl-12 to avoid excessive padding
  
  return (
    <ul className={`${paddingClass} list-disc`}>
      {nodes.map((node, i) => (
        <li key={i} className="my-1">
          <span className="font-medium">{node.nodeTitle}</span>
          <span className="text-xs text-gray-500"> ({node.nodeType})</span>
          
          {node.content && (
            <div className="ml-4 mt-1 p-2 bg-gray-50 rounded text-sm">
              <div className="text-xs text-gray-500 mb-1">Content:</div>
              {node.content}
            </div>
          )}
          
          {node.children && node.children.length > 0 && (
            <RenderHierarchyNodes nodes={node.children} level={level + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ResponseDemo() {
  const [response, setResponse] = useState<FlexibleHierarchicalResponse | null>(null);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch the demo response when the component mounts
  useEffect(() => {
    const fetchDemoResponse = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/demo/response');
        
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        
        // Store both raw and parsed versions
        setRawResponse(JSON.stringify(data, null, 2));
        setResponse(data);
        
      } catch (err) {
        console.error('Error fetching demo response:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDemoResponse();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Flexible Hierarchical Response Demo</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Raw JSON Response from Backend</h2>
        {loading ? (
          <div className="animate-pulse h-60 bg-gray-200 rounded"></div>
        ) : error ? (
          <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
        ) : (
          <div className="p-4 bg-gray-100 rounded overflow-auto max-h-[400px]">
            <pre className="text-sm">{rawResponse}</pre>
          </div>
        )}
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Rendered Hierarchical Response</h2>
        {loading ? (
          <div className="animate-pulse h-96 bg-gray-200 rounded"></div>
        ) : error ? (
          <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
        ) : response ? (
          <div>
            <div className="mb-4 p-4 bg-blue-50 rounded">
              <h3 className="font-semibold mb-2">{response.message}</h3>
            </div>
            
            {response.documents.map((document, i) => (
              <div key={i} className="mb-6 p-4 border rounded shadow-sm">
                <h3 className="text-lg font-bold mb-2">{document.documentTitle || document.documentId}</h3>
                
                {document.documentStructure && (
                  <div className="mb-4 text-sm text-gray-600">
                    <span className="font-medium">Structure:</span> {document.documentStructure.format} 
                    {document.documentStructure.levels && ` (${document.documentStructure.levels.join(' › ')})`}
                  </div>
                )}
                
                {document.nodes && document.nodes.length > 0 ? (
                  <RenderHierarchyNodes nodes={document.nodes} />
                ) : (
                  <p className="text-gray-500">No hierarchy nodes available</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>No response data</div>
        )}
      </div>
    </div>
  );
} 