import React, { useState, useEffect, useRef } from 'react';

const BrainUI = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeThreads, setActiveThreads] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [stats, setStats] = useState({ totalDocuments: 0, totalQueries: 0 });
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  const BRAIN_API = process.env.NEXT_PUBLIC_BRAIN_API || 'https://brain-worker.dusty-786.workers.dev';
  
  // Quick actions configuration
  const quickActions = [
    {
      id: 1,
      title: 'Weekly Summary',
      description: 'What did I work on this week?',
      query: 'Give me a summary of what I worked on this week',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      id: 2,
      title: 'Project Status',
      description: 'Check on active projects',
      query: 'priority',
      color: 'bg-green-100 text-green-600'
    },
    {
      id: 3,
      title: 'Key Insights',
      description: 'Discover patterns and connections',
      query: 'What patterns or insights can you find in my recent work?',
      color: 'bg-purple-100 text-purple-600'
    }
  ];

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Load active threads and stats on mount
  useEffect(() => {
    loadPriorities();
    loadStats();
  }, []);
  
  const loadPriorities = async () => {
    try {
      const response = await fetch(`${BRAIN_API}/priority`);
      const data = await response.json();
      if (data.allThreads) {
        setActiveThreads(data.allThreads.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load priorities:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${BRAIN_API}/health`);
      const data = await response.json();
      setStats({
        totalDocuments: data.totalDocuments || 0,
        totalQueries: data.totalQueries || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };
  
  // Parse natural language queries
  const parseQuery = (text) => {
    const query = text.toLowerCase().trim();
    
    // Command recognition
    if (query === 'priority' || query === 'priorities') {
      return { type: 'command', command: 'priority', original: text };
    }
    
    if (query === 'status' || query.includes('project status')) {
      return { type: 'command', command: 'status', original: text };
    }
    
    if (query === 'health' || query === 'system health') {
      return { type: 'command', command: 'health', original: text };
    }
    
    // Thread-based queries
    if (query.includes('thread:')) {
      const threadMatch = text.match(/thread:\s*(\S+)/i);
      if (threadMatch) {
        return { 
          type: 'thread', 
          thread: threadMatch[1],
          original: text 
        };
      }
    }
    
    // Default to semantic search
    return { type: 'search', query: text, original: text };
  };
  
  // Handle query submission
  const handleQuery = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setShowSuggestions(false);
    
    // Add user message
    const userMessage = { 
      role: 'user', 
      content: query, 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMessage]);

    const currentQuery = query;
    setQuery('');

    try {
      const parsedQuery = parseQuery(currentQuery);
      let response;
      
      // Route based on parsed query type
      switch (parsedQuery.type) {
        case 'command':
          if (parsedQuery.command === 'priority') {
            response = await fetch(`${BRAIN_API}/priority`);
          } else if (parsedQuery.command === 'health') {
            response = await fetch(`${BRAIN_API}/health`);
          } else {
            response = await fetch(`${BRAIN_API}/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: 'project status current active' })
            });
          }
          break;
          
        case 'thread':
          response = await fetch(`${BRAIN_API}/thread`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread: parsedQuery.thread })
          });
          break;
          
        default:
          response = await fetch(`${BRAIN_API}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: parsedQuery.query || parsedQuery.original,
              limit: 10
            })
          });
          break;
      }

      const data = await response.json();
      
      // Format response based on type
      let content = 'No results found.';
      if (data.results && data.results.length > 0) {
        content = `Found ${data.results.length} relevant thoughts:\n\n`;
        data.results.forEach((result, idx) => {
          content += `${idx + 1}. ${result.content}\n\n`;
        });
      } else if (data.allThreads) {
        content = 'Active threads:\n\n';
        data.allThreads.slice(0, 5).forEach(thread => {
          content += `#${thread.thread} - ${thread.count} items (${thread.topic || 'No topic'})\n`;
        });
      } else if (data.message) {
        content = data.message;
      }
      
      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: content,
        data: data,
        timestamp: new Date(),
        type: parsedQuery.type
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Query failed:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action handler
  const handleQuickAction = (action) => {
    setQuery(action.query);
    setShowSuggestions(false);
    if (action.query === 'priority') {
      setTimeout(() => {
        setQuery(action.query);
        handleQuery();
      }, 100);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f9fafb, #e0e7ff)', padding: '1rem' }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', paddingTop: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Your Second Brain
          </h1>
          <p style={{ color: '#6b7280' }}>Ask me anything about your thoughts and projects</p>
        </div>

        {/* Messages */}
        <div style={{ 
          background: 'white', 
          borderRadius: '0.75rem', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          minHeight: '400px',
          maxHeight: '600px',
          overflow: 'auto',
          marginBottom: '1.5rem'
        }}>
          <div style={{ padding: '1.5rem' }}>
            {messages.length === 0 && showSuggestions ? (
              <div style={{ textAlign: 'center', paddingTop: '3rem', paddingBottom: '3rem' }}>
                <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>Try asking me something like:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px', margin: '0 auto' }}>
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action)}
                      style={{
                        textAlign: 'left',
                        padding: '0.5rem 1rem',
                        background: '#f9fafb',
                        borderRadius: '0.5rem',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.background = '#f9fafb'}
                    >
                      → {action.description}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '70%',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        background: message.role === 'user' 
                          ? 'linear-gradient(to right, #8b5cf6, #ec4899)'
                          : '#f3f4f6',
                        color: message.role === 'user' ? 'white' : '#1f2937'
                      }}
                    >
                      <pre style={{ 
                        margin: 0, 
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit'
                      }}>
                        {message.content}
                      </pre>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ 
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: '#f3f4f6',
                      color: '#6b7280'
                    }}>
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div style={{ 
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              ref={textareaRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuery();
                }
              }}
              placeholder="Ask about your projects, thoughts, or what you've been working on..."
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '1rem',
                outline: 'none'
              }}
              disabled={isLoading}
            />
            <button
              onClick={handleQuery}
              disabled={isLoading || !query.trim()}
              style={{
                padding: '0.5rem 1.5rem',
                background: isLoading || !query.trim() 
                  ? '#e5e7eb'
                  : 'linear-gradient(to right, #8b5cf6, #ec4899)',
                color: 'white',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '500',
                cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              Ask
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
          <p>Powered by your Brain API • {activeThreads.length} active threads</p>
        </div>
      </div>
    </div>
  );
};

export default BrainUI;