import React, { useState, useEffect, useRef } from 'react';
import './DirectInquiriesStyles.css';

const DirectInquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Load inquiries on mount
  useEffect(() => {
    loadInquiries();
    // Poll for new inquiries every 5 seconds
    const interval = setInterval(loadInquiries, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Restore selected inquiry from localStorage
  useEffect(() => {
    const savedInquiryId = localStorage.getItem('selectedInquiryId');
    if (savedInquiryId && inquiries.length > 0) {
      const inquiry = inquiries.find(i => i.id === parseInt(savedInquiryId));
      if (inquiry) {
        handleSelectInquiry(inquiry);
      }
    }
  }, [inquiries]);

  const loadInquiries = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/admin/direct-chats');
      // const data = await response.json();
      
      // Mock data for now
      const mockData = [
        {
          id: 1,
          userSessionId: 'user-123',
          status: 'waiting',
          lastMessage: 'I need help with enrollment',
          lastActivity: new Date().toISOString(),
          unreadCount: 2
        },
        {
          id: 2,
          userSessionId: 'user-456',
          status: 'active',
          lastMessage: 'Thank you for your help!',
          lastActivity: new Date(Date.now() - 300000).toISOString(),
          unreadCount: 0
        }
      ];
      setInquiries(mockData);
    } catch (error) {
      console.error('Failed to load inquiries:', error);
    }
  };

  const handleSelectInquiry = async (inquiry) => {
    setSelectedInquiry(inquiry);
    localStorage.setItem('selectedInquiryId', inquiry.id);
    setLoading(true);
    
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/admin/direct-chats/${inquiry.id}/messages`);
      // const data = await response.json();
      
      // Mock messages
      const mockMessages = [
        {
          id: 1,
          senderType: 'user',
          message: 'I need help with enrollment',
          sentAt: new Date(Date.now() - 600000).toISOString()
        },
        {
          id: 2,
          senderType: 'user',
          message: 'What are the requirements?',
          sentAt: new Date(Date.now() - 300000).toISOString()
        }
      ];
      setMessages(mockMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedInquiry) return;
    
    setSending(true);
    
    try {
      // TODO: Replace with actual API call
      // await fetch(`/admin/direct-chats/${selectedInquiry.id}/messages`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ message: replyText, senderType: 'admin' })
      // });
      
      // Add message optimistically
      const newMessage = {
        id: Date.now(),
        senderType: 'admin',
        message: replyText,
        sentAt: new Date().toISOString()
      };
      setMessages([...messages, newMessage]);
      setReplyText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleCloseInquiry = async () => {
    if (!selectedInquiry) return;
    
    try {
      // TODO: Replace with actual API call
      // await fetch(`/admin/direct-chats/${selectedInquiry.id}/status`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ status: 'closed' })
      // });
      
      setSelectedInquiry(null);
      localStorage.removeItem('selectedInquiryId');
      loadInquiries();
    } catch (error) {
      console.error('Failed to close inquiry:', error);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return '#f59e0b';
      case 'active': return '#10b981';
      case 'closed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className="direct-inquiries-wrapper">
      <div className="direct-inquiries-container">
        {/* Header */}
        <div className="inquiries-header">
          <h2 className="inquiries-title">
            <svg className="inquiries-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Direct Inquiries
          </h2>
        </div>

        {/* Main Content */}
        <div className="inquiries-content-wrapper">
          {/* Inquiries List */}
          <div className="inquiries-list-section">
            <div className="inquiries-list-header">
              <h3>Active Conversations ({inquiries.length})</h3>
              <button className="refresh-button" onClick={loadInquiries}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <div className="inquiries-list">
              {inquiries.length === 0 ? (
                <div className="empty-state">
                  <p>No active inquiries</p>
                </div>
              ) : (
                inquiries.map(inquiry => (
                  <div
                    key={inquiry.id}
                    className={`inquiry-item ${selectedInquiry?.id === inquiry.id ? 'active' : ''}`}
                    onClick={() => handleSelectInquiry(inquiry)}
                  >
                    <div className="inquiry-item-header">
                      <div className="inquiry-user">
                        <div className="user-avatar">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="user-id">{inquiry.userSessionId}</span>
                      </div>
                      <span 
                        className="inquiry-status"
                        style={{ backgroundColor: getStatusColor(inquiry.status) }}
                      >
                        {inquiry.status}
                      </span>
                    </div>
                    <p className="inquiry-preview">{inquiry.lastMessage}</p>
                    <div className="inquiry-meta">
                      <span className="inquiry-time">{formatTime(inquiry.lastActivity)}</span>
                      {inquiry.unreadCount > 0 && (
                        <span className="unread-badge">{inquiry.unreadCount}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Section */}
          <div className="inquiry-chat-section">
            {!selectedInquiry ? (
              <div className="no-selection">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>Select a conversation to view messages</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="chat-header-bar">
                  <div className="chat-user-info">
                    <h3>{selectedInquiry.userSessionId}</h3>
                    <span className="chat-status">{selectedInquiry.status}</span>
                  </div>
                  <button className="close-inquiry-button" onClick={handleCloseInquiry}>
                    Close Inquiry
                  </button>
                </div>

                {/* Messages */}
                <div className="inquiry-messages">
                  {loading ? (
                    <div className="loading-messages">
                      <div className="loading-spinner"></div>
                      <p>Loading messages...</p>
                    </div>
                  ) : (
                    <>
                      {messages.map(msg => (
                        <div key={msg.id} className={`message-container ${msg.senderType}`}>
                          <div className={`message-bubble ${msg.senderType}`}>
                            <p className="message-content">{msg.message}</p>
                            <span className="message-time">{formatTime(msg.sentAt)}</span>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Reply Input */}
                <div className="reply-input-section">
                  <div className="reply-input-container">
                    <textarea
                      className="reply-textarea"
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      rows={3}
                    />
                    <button
                      className="send-reply-button"
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sending}
                    >
                      {sending ? (
                        <>
                          <div className="loading-spinner small"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Send Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectInquiries;