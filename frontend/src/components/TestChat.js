import React, { useState, useRef, useEffect } from 'react';
import { admin } from '../api';
import './TestChatStyles.css';

const TestChat = () => {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `test_${Date.now()}`);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation, loading]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');
    setLoading(true);

    // Add user message to conversation
    setConversation(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    try {
      const response = await admin.testChat(userMessage, sessionId);
      
      // Add bot response to conversation
      setConversation(prev => [...prev, {
        type: 'bot',
        content: response.data.answer,
        sources: response.data.sources,
        responseTime: response.data.response_time_ms,
        timestamp: new Date()
      }]);
    } catch (error) {
      setConversation(prev => [...prev, {
        type: 'bot',
        content: 'Sorry, there was an error processing your message. Please try again.',
        error: true,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    setConversation([]);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const setSampleQuestion = (question) => {
    setMessage(question);
  };

  return (
    <div className="test-chat-wrapper">
      <div className="test-chat-container">
        {/* Header */}
        <div className="chat-header">
          <h2 className="chat-title">
            <svg className="chat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Test Student Chatbot
          </h2>
          
          {conversation.length > 0 && (
            <button onClick={clearConversation} className="clear-button">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Chat
            </button>
          )}
        </div>

        {/* Chat Window */}
        <div className="chat-window">
          <div className="chat-messages">
            {conversation.length === 0 ? (
              <div className="chat-empty">
                <svg className="empty-chat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="empty-title">Start a conversation with your student chatbot</h3>
                <p className="empty-subtitle">Try asking about uploaded documents</p>
              </div>
            ) : (
              <>
                {conversation.map((msg, index) => (
                  <div key={index} className={`message-container ${msg.type}`}>
                    <div className={`message-bubble ${msg.type} ${msg.error ? 'error' : ''}`}>
                      <p className="message-content">{msg.content}</p>
                      
                      {/* Sources for bot messages */}
                      {msg.type === 'bot' && msg.sources && msg.sources.length > 0 && (
                        <div className="message-sources">
                          <p className="sources-label">Sources:</p>
                          <div className="source-tags">
                            {msg.sources.map((source, idx) => (
                              <span key={idx} className="source-tag">
                                {source.filename} (p. {source.page})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message metadata */}
                      <div className="message-meta">
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                        {msg.type === 'bot' && msg.responseTime && (
                          <span className="response-time">{msg.responseTime}ms</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="loading-message">
                    <div className="loading-bubble">
                      <div className="loading-spinner"></div>
                      <span className="loading-text">Thinking...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input Section */}
        <div className="chat-input-section">
          <div className="input-container">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your uploaded documents..."
              className="message-textarea"
              disabled={loading}
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              className="send-button"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </button>
          </div>

          {/* Sample Questions */}
          <div className="sample-questions">
            <p className="sample-title">
              <svg className="sample-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Sample questions to try:
            </p>
            <div className="sample-buttons">
              {[
                "What are the graduation requirements?",
                "When is the deadline for course registration?",
                "How do I apply for financial aid?",
                "What documents do I need for enrollment?"
              ].map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => setSampleQuestion(question)}
                  className="sample-button"
                  disabled={loading}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestChat;