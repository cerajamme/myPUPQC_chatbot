import React, { useState } from 'react';
import { admin } from '../api';

const TestChat = () => {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `test_${Date.now()}`);

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
          Test Student Chatbot
        </h2>
        {conversation.length > 0 && (
          <button 
            onClick={clearConversation}
            className="btn"
            style={{ 
              padding: '8px 16px', 
              fontSize: '14px',
              backgroundColor: '#f3f4f6',
              color: '#6b7280'
            }}
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Chat Window */}
      <div style={{
        height: '400px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb',
        padding: '16px',
        overflowY: 'auto',
        marginBottom: '16px'
      }}>
        {conversation.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '160px' }}>
            <p>Start a conversation with your student chatbot</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Try asking about uploaded documents
            </p>
          </div>
        ) : (
          conversation.map((msg, index) => (
            <div key={index} style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: msg.type === 'user' ? '#3b82f6' : '#ffffff',
                color: msg.type === 'user' ? '#ffffff' : '#1f2937',
                border: msg.type === 'bot' ? '1px solid #e5e7eb' : 'none'
              }}>
                <p style={{ margin: 0, lineHeight: '1.5' }}>{msg.content}</p>
                
                {/* Sources for bot messages */}
                {msg.type === 'bot' && msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Sources:</p>
                    {msg.sources.map((source, idx) => (
                      <span key={idx} style={{
                        fontSize: '11px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginRight: '4px',
                        display: 'inline-block'
                      }}>
                        {source.filename} (p. {source.page})
                      </span>
                    ))}
                  </div>
                )}

                {/* Response time for bot messages */}
                {msg.type === 'bot' && msg.responseTime && (
                  <p style={{ 
                    fontSize: '11px', 
                    color: '#9ca3af', 
                    margin: '4px 0 0 0',
                    textAlign: 'right'
                  }}>
                    {msg.responseTime}ms
                  </p>
                )}

                {/* Timestamp */}
                <p style={{ 
                  fontSize: '11px', 
                  color: msg.type === 'user' ? '#bfdbfe' : '#9ca3af',
                  margin: '4px 0 0 0',
                  textAlign: 'right'
                }}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="loading-spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question about your uploaded documents..."
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            resize: 'none',
            minHeight: '50px',
            fontFamily: 'inherit'
          }}
          disabled={loading}
        />
        <button
          onClick={handleSendMessage}
          disabled={!message.trim() || loading}
          className="btn btn-primary"
          style={{
            padding: '12px 20px',
            height: 'fit-content',
            opacity: (!message.trim() || loading) ? 0.6 : 1
          }}
        >
          Send
        </button>
      </div>

      {/* Sample Questions */}
      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
        <p style={{ fontSize: '14px', fontWeight: '500', color: '#0369a1', marginBottom: '8px' }}>
          Sample questions to try:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            "What are the graduation requirements?",
            "When is the deadline for course registration?",
            "How do I apply for financial aid?",
            "What documents do I need for enrollment?"
          ].map((question, idx) => (
            <button
              key={idx}
              onClick={() => setMessage(question)}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                backgroundColor: '#ffffff',
                border: '1px solid #bae6fd',
                borderRadius: '4px',
                color: '#0369a1',
                cursor: 'pointer'
              }}
              disabled={loading}
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestChat;