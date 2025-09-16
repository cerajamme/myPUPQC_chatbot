import React, { useState, useRef, useEffect } from 'react';
import { admin } from '../api';
import './TestChatStyles.css';

const TestChat = () => {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `test_${Date.now()}`);
  const [hasStarted, setHasStarted] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [newOption, setNewOption] = useState('');
  const [addingOption, setAddingOption] = useState(false);
  const [deletingOption, setDeletingOption] = useState(null);
  const messagesEndRef = useRef(null);

  // Static fallback options
  const fallbackOptions = [
    "What are the requirements for Latin honors?",
    "How do I enroll for the next semester?",
    "What financial aid options are available?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation, loading]);

  // Fetch dynamic chat options from backend
  const fetchChatOptions = async () => {
    try {
      const response = await admin.getChatOptions();
      if (response.data && response.data.length > 0) {
        setDynamicOptions(response.data);
      } else {
        // Use fallback if no dynamic options
        setDynamicOptions(fallbackOptions.map((label, index) => ({ id: index, label, is_active: true })));
      }
    } catch (error) {
      console.error('Failed to load chat options:', error);
      // Use fallback options on error
      setDynamicOptions(fallbackOptions.map((label, index) => ({ id: index, label, is_active: true })));
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    fetchChatOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add welcome message when chat starts
  useEffect(() => {
    if (!hasStarted) {
      setConversation([{
        type: 'bot',
        content: 'Hello! I\'m your PUPQC Student Assistant. I\'m here to help you with information about enrollment, academic requirements, policies, and other student services. How can I assist you today?',
        timestamp: new Date()
      }]);
      setHasStarted(true);
    }
  }, [hasStarted]);

  // Clean response text to remove PDF references
  const cleanResponse = (text) => {
    return text
      .replace(/Based on the provided text from[^,]*,?\s*/gi, '')
      .replace(/Page \d+\s*-?\s*/gi, '')
      .replace(/\.pdf/gi, '')
      .replace(/The document details/gi, 'The information covers')
      .replace(/according to the document/gi, '')
      .replace(/from the document/gi, '')
      .replace(/the document states/gi, 'the information indicates')
      .replace(/as mentioned in the text/gi, '')
      .trim();
  };

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
      
      // Add bot response to conversation (cleaned up)
      setConversation(prev => [...prev, {
        type: 'bot',
        content: cleanResponse(response.data.answer),
        timestamp: new Date()
      }]);
    } catch (error) {
      setConversation(prev => [...prev, {
        type: 'bot',
        content: 'I apologize, but I\'m having trouble processing your request right now. Could you please try asking your question again?',
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
    setHasStarted(false);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  //   // Keep this function for sample buttons
  // const setSampleQuestion = (question) => {
  //   setMessage(question);
  // };

  // Create a separate function for auto-send options
  const handleOptionClick = async (optionLabel) => {
    // Don't call setSampleQuestion - go straight to sending
    setLoading(true);
    
    // Add user message to conversation
    setConversation(prev => [...prev, {
      type: 'user',
      content: optionLabel,
      timestamp: new Date()
    }]);

    try {
      const response = await admin.testChat(optionLabel, sessionId);
      
      // Add bot response to conversation (cleaned up)
      setConversation(prev => [...prev, {
        type: 'bot',
        content: cleanResponse(response.data.answer),
        timestamp: new Date()
      }]);
    } catch (error) {
      setConversation(prev => [...prev, {
        type: 'bot',
        content: 'I apologize, but I\'m having trouble processing your request right now. Could you please try asking your question again?',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Add new chat option
  const handleAddOption = async () => {
    if (!newOption.trim()) return;

    setAddingOption(true);
    try {
      await admin.createChatOption({ 
        label: newOption.trim(), 
        order: dynamicOptions.length 
      });
      setNewOption('');
      await fetchChatOptions(); // Refresh the options
    } catch (error) {
      console.error('Failed to add option:', error);
      alert('Failed to add option. Please try again.');
    } finally {
      setAddingOption(false);
    }
  };

  // Delete chat option
  const handleDeleteOption = async (optionId) => {
    setDeletingOption(optionId);
    try {
      await admin.deleteChatOption(optionId);
      await fetchChatOptions(); // Refresh the options
    } catch (error) {
      console.error('Failed to delete option:', error);
      alert('Failed to delete option. Please try again.');
    } finally {
      setDeletingOption(null);
    }
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
            PUPQC Student Assistant
          </h2>
          
          {conversation.length > 0 && (
            <button onClick={clearConversation} className="clear-button">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.357 2m-15.357-2H9" />
              </svg>
              New Chat
            </button>
          )}
        </div>

        {/* Main Content - Side by Side */}
        <div className="chat-content-wrapper">
          {/* Left Side - Chat */}
          <div className="chat-section">
            {/* Chat Window */}
            <div className="chat-window">
              <div className="chat-messages">
                {conversation.map((msg, index) => (
                  <div key={index} className={`message-container ${msg.type}`}>
                    <div className={`message-bubble ${msg.type}`}>
                      <p className="message-content">{msg.content}</p>
                      
                      {/* Only show timestamp */}
                      <div className="message-meta">
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
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
              </div>
            </div>

            {/* Input Section */}
            <div className="chat-input-section">
              <div className="input-container">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about PUPQC student services..."
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
            </div>
          </div>

          {/* Right Side - Options & Admin */}
          <div className="admin-section">
            {/* Quick Options */}
            <div className="sample-questions">
              <p className="sample-title">
                <svg className="sample-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Quick questions:
              </p>
              
              {loadingOptions ? (
                <div className="loading-options">
                  <div className="loading-spinner"></div>
                  <span>Loading options...</span>
                </div>
              ) : (
                <div className="sample-buttons">
                  {dynamicOptions
                    .filter(option => option.is_active !== false)
                    .map((option, idx) => (
                      <button
                        key={option.id || idx}
                        onClick={() => handleOptionClick(option.label)}
                        className="sample-button"
                        disabled={loading}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Admin Options Management */}
            <div className="admin-options-section">
              <div className="admin-header">
                <h3 className="admin-title">
                  <svg className="admin-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin: Manage Quick Options
                </h3>
              </div>

              {/* Add New Option */}
              <div className="add-option-form">
                <div className="form-group">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Enter new quick question..."
                    className="option-input"
                    disabled={addingOption}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddOption();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddOption}
                    disabled={!newOption.trim() || addingOption}
                    className="add-option-button"
                  >
                    {addingOption ? (
                      <>
                        <div className="loading-spinner small"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Current Options List */}
              <div className="current-options">
                <h4 className="options-list-title">Current Options:</h4>
                <div className="options-list">
                  {dynamicOptions.map((option) => (
                    <div key={option.id} className="option-item">
                      <span className="option-text">{option.label}</span>
                      <button
                        onClick={() => handleDeleteOption(option.id)}
                        disabled={deletingOption === option.id}
                        className="delete-option-button"
                        title="Delete this option"
                      >
                        {deletingOption === option.id ? (
                          <div className="loading-spinner small"></div>
                        ) : (
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestChat;