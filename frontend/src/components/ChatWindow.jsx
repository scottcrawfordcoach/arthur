// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Upload, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import FileUpload from './FileUpload';

export default function ChatWindow({ sessionId, onSessionCreated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const serverTimeOffsetRef = useRef(0); // serverTime - clientNow

  // Load messages when session changes
  useEffect(() => {
    if (sessionId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/chat/${sessionId}/history`);
      const data = await response.json();
      setMessages(data.history || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI
    const userMsg = {
      role: 'user',
      content: userMessage,
      // approximate created_at aligned to server clock if available
      created_at: new Date(Date.now() + serverTimeOffsetRef.current).toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId || null
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let assistantMessage = {
        role: 'assistant',
        content: '',
        created_at: new Date(Date.now() + serverTimeOffsetRef.current).toISOString()
      };
      
      let newSessionId = sessionId;
      let streamId = null;
      let initialServerTime = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'metadata') {
                newSessionId = data.sessionId;
                streamId = data.streamId;
                setCurrentStreamId(streamId);
                // Track server time offset for consistent timestamps
                if (data.serverTime) {
                  try {
                    initialServerTime = new Date(data.serverTime).getTime();
                    serverTimeOffsetRef.current = initialServerTime - Date.now();
                  } catch {}
                }
                
                // Notify parent of new session
                if (!sessionId && onSessionCreated) {
                  onSessionCreated(newSessionId);
                }
              } else if (data.type === 'content') {
                assistantMessage.content += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  
                  if (lastMsg?.role === 'assistant' && !lastMsg.id) {
                    newMessages[newMessages.length - 1] = { ...assistantMessage };
                  } else {
                    newMessages.push({ ...assistantMessage });
                  }
                  
                  return newMessages;
                });
              } else if (data.type === 'done') {
                assistantMessage.id = data.messageId;
                assistantMessage.content = data.fullContent;
                if (data.createdAt) {
                  // authoritative timestamp from server
                  assistantMessage.created_at = data.createdAt;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    // replace the last assistant placeholder with final including created_at
                    for (let i = newMessages.length - 1; i >= 0; i--) {
                      if (newMessages[i].role === 'assistant' && !newMessages[i].id) {
                        newMessages[i] = { ...assistantMessage };
                        break;
                      }
                    }
                    return newMessages;
                  });
                }
                // Notify other panels (e.g., UnifiedTimeline) to refresh
                try {
                  window.dispatchEvent(new CustomEvent('timeline:refresh'));
                } catch {}
              } else if (data.type === 'aborted') {
                assistantMessage.content += '\n\n[Response stopped]';
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Chat error:', error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${error.message}`,
          created_at: new Date().toISOString()
        }]);
      }
    } finally {
      setIsLoading(false);
      setCurrentStreamId(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = async () => {
    if (currentStreamId) {
      try {
        await fetch('/api/chat/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamId: currentStreamId })
        });
      } catch (error) {
        console.error('Failed to abort:', error);
      }
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-pastel-mint to-pastel-blue">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <h2 className="text-3xl font-bold text-mint-600 mb-2">
                Welcome to ScottBot Local
              </h2>
              <p className="text-lg">
                Your personal AI assistant with semantic recall and web search
              </p>
              <p className="mt-4 text-sm">
                Start a conversation or upload a file to begin
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prev = messages[idx - 1];
            const showDaySeparator = (() => {
              if (!prev) return true;
              const d1 = new Date(prev.created_at || 0);
              const d2 = new Date(msg.created_at || 0);
              return d1.toDateString() !== d2.toDateString();
            })();
            const showTimestamp = (() => {
              if (!prev) return true;
              const t1 = new Date(prev.created_at || 0).getTime();
              const t2 = new Date(msg.created_at || 0).getTime();
              const gap = Math.abs(t2 - t1);
              const roleChanged = prev.role !== msg.role;
              return showDaySeparator || roleChanged || gap > 5 * 60 * 1000; // 5 minutes
            })();
            const tsTitle = msg.created_at ? new Date(msg.created_at).toLocaleString() : '';
            const tsLabel = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            return (
              <div key={idx} className="space-y-2">
                {showDaySeparator && msg.created_at && (
                  <div className="flex items-center justify-center my-2">
                    <div className="text-xs text-gray-400 bg-white/60 px-3 py-1 rounded-full shadow-sm">
                      {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
                {showTimestamp && msg.created_at && (
                  <div className="flex items-center justify-center">
                    <div className="text-[11px] text-gray-400" title={tsTitle}>{tsLabel}</div>
                  </div>
                )}
                <div
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 
                    msg.role === 'system' ? 'justify-center' : 
                    'justify-start'
                  }`}
                >
                  <div
                    className={`
                      max-w-3xl px-6 py-4 rounded-2xl shadow-sm
                      ${msg.role === 'user'
                        ? 'bg-mint-500 text-white'
                        : msg.role === 'system'
                        ? 'bg-blue-50 text-gray-800 border-2 border-blue-200'
                        : 'bg-white text-gray-800'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        {msg.role === 'assistant' || msg.role === 'system' ? (
                          <div className="markdown-content prose prose-sm">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <button
            onClick={() => setShowFileUpload(true)}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Upload file"
          >
            <Upload size={24} className="text-gray-600" />
          </button>

          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-mint-400 focus:outline-none resize-none"
              rows={1}
              style={{ maxHeight: '150px', minHeight: '50px' }}
              disabled={isLoading}
            />
          </div>

          {isLoading ? (
            <button
              onClick={handleStop}
              className="p-3 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              title="Stop generation"
            >
              <StopCircle size={24} className="text-white" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-3 bg-mint-500 hover:bg-mint-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              title="Send message"
            >
              <Send size={24} className="text-white" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="max-w-4xl mx-auto mt-2 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            <span>ScottBot is thinking...</span>
          </div>
        )}
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload 
          onClose={() => setShowFileUpload(false)}
          onSuccess={(uploadResult) => {
            // Add acknowledgment as system message
            const systemMsg = {
              role: 'system',
              content: `📄 **${uploadResult.fileName}** uploaded successfully!\n\n${uploadResult.acknowledgment}`,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, systemMsg]);
          }}
        />
      )}
    </div>
  );
}
