import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface Section {
  id: string;
  title: string;
  content: string;
}

interface ToolCall {
  id: string;
  key: string;
  createdAt: Date;
  sectionsCount: number;
}

const LawSearchView: React.FC = () => {
  const { id: conversationId } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const uid = searchParams?.get('uid'); // Get uid directly from URL
  
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [selectedToolCall, setSelectedToolCall] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState({
    toolCalls: false,
    sections: false
  });
  const [error, setError] = useState<string | null>(null);

  // Load tool calls when component mounts
  useEffect(() => {
    if (!uid || !conversationId) return;
    
    async function loadToolCalls() {
      setLoading(prev => ({ ...prev, toolCalls: true }));
      setError(null);
      
      try {
        const response = await fetch(`/api/list-tool-calls?uid=${uid}&conversationId=${conversationId}`);
        const data = await response.json();
        
        if (data.success && data.toolCalls) {
          // Sort by createdAt in descending order (newest first)
          const sortedToolCalls = data.toolCalls.sort((a: ToolCall, b: ToolCall) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          setToolCalls(sortedToolCalls);
          
          // Auto-select the first tool call if available
          if (sortedToolCalls.length > 0) {
            setSelectedToolCall(sortedToolCalls[0].id);
          }
        } else {
          setError(data.error || 'Failed to load search results');
        }
      } catch (err) {
        setError('Error loading search results');
        console.error('Error loading tool calls:', err);
      } finally {
        setLoading(prev => ({ ...prev, toolCalls: false }));
      }
    }
    
    loadToolCalls();
  }, [uid, conversationId]);

  // Load sections when a tool call is selected
  useEffect(() => {
    if (!uid || !conversationId || !selectedToolCall) return;
    
    async function loadSections() {
      setLoading(prev => ({ ...prev, sections: true }));
      setSections([]);
      
      try {
        const response = await fetch(
          `/api/get-sections?uid=${uid}&conversationId=${conversationId}&toolCallId=${selectedToolCall}`
        );
        const data = await response.json();
        
        if (data.success && data.sections) {
          setSections(data.sections);
        } else {
          console.error('Failed to load sections:', data.error);
        }
      } catch (err) {
        console.error('Error loading sections:', err);
      } finally {
        setLoading(prev => ({ ...prev, sections: false }));
      }
    }
    
    loadSections();
  }, [uid, conversationId, selectedToolCall]);

  // Handle tool call selection
  const handleToolCallSelect = (toolCallId: string) => {
    setSelectedToolCall(toolCallId);
    setExpandedSection(null); // Reset expanded section
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  if (!uid) {
    return (
      <div className="p-4 bg-yellow-50 text-yellow-700 rounded">
        <h2 className="text-lg font-medium">User ID Required</h2>
        <p>Please provide a user ID to view search results. Add ?uid=YOUR_USER_ID to the URL.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded">
        <h2 className="text-lg font-medium">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <h1 className="text-2xl font-bold">Law Search Results</h1>
      
      {/* Tool Calls / Search Queries */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Search Queries</h2>
        
        {loading.toolCalls ? (
          <div className="py-4 text-center">Loading search history...</div>
        ) : toolCalls.length === 0 ? (
          <div className="py-4 text-center text-gray-500">No search history found</div>
        ) : (
          <div className="space-y-2">
            {toolCalls.map(toolCall => (
              <div 
                key={toolCall.id}
                className={`p-3 rounded-md cursor-pointer ${
                  selectedToolCall === toolCall.id 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-white border hover:bg-gray-50'
                }`}
                onClick={() => handleToolCallSelect(toolCall.id)}
              >
                <div className="font-medium">{toolCall.key || 'Unnamed search'}</div>
                <div className="text-sm text-gray-500 flex justify-between">
                  <span>{formatDate(toolCall.createdAt)}</span>
                  <span>{toolCall.sectionsCount} sections</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Sections */}
      <div className="bg-white shadow-sm border rounded-lg">
        <h2 className="text-xl font-semibold p-4 border-b">
          {selectedToolCall 
            ? `Sections (${sections.length})` 
            : 'Select a search to view sections'}
        </h2>
        
        {selectedToolCall && (
          loading.sections ? (
            <div className="p-4 text-center">Loading sections...</div>
          ) : sections.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No sections found for this search</div>
          ) : (
            <div className="divide-y">
              {sections.map(section => (
                <div key={section.id} className="p-0">
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div>
                      <h3 className="font-medium">{section.id}</h3>
                      <p className="text-sm text-gray-600">{section.title || 'Untitled section'}</p>
                    </div>
                    <div className="text-gray-400">
                      {expandedSection === section.id ? '▲' : '▼'}
                    </div>
                  </div>
                  
                  {expandedSection === section.id && (
                    <div className="p-4 bg-gray-50 border-t whitespace-pre-wrap font-mono text-sm">
                      {section.content || 'No content available'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
      
      {/* Migration Button */}
      <div className="mt-4">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2"
          onClick={async () => {
            if (!uid || !conversationId) return;
            
            try {
              const response = await fetch('/api/migrate-sections', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  uid,
                  conversationId
                })
              });
              
              const data = await response.json();
              if (data.success) {
                alert(`Migration complete: ${data.migratedSections} sections processed`);
                // Reload tool calls
                window.location.reload();
              } else {
                alert(`Migration failed: ${data.error}`);
              }
            } catch (err) {
              console.error('Migration error:', err);
              alert('Error during migration');
            }
          }}
        >
          Migrate Sections
        </button>
      </div>
    </div>
  );
};

export default LawSearchView; 