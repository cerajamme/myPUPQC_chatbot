import React, { useState, useEffect } from 'react';
// import { admin } from '../api';
import './DirectInquiriesStyles.css';

const DirectInquiries = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);

  // Load chats on mount and refresh every 5 seconds
  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadChats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://mypupqcchatbot-production.up.railway.app/admin/direct-chats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const selectChat = async (chat) => {
    setSelectedChat(chat);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://mypupqcchatbot-production.up.railway.app/admin/direct-chats/${chat.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
    setLoading(false);
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedChat) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`https://mypupqcchatbot-production.up.railway.app/admin/direct-chats/${selectedChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: reply })
      });

      // Add to UI immediately
      setMessages([...messages, {
        id: Date.now(),
        sender_type: 'admin',
        message: reply,
        sent_at: new Date().toISOString()
      }]);
      setReply('');
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date)) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatSessionId = (sessionId) => {
    // Extract just the number from admin_xxxxx_timestamp format
    const match = sessionId.match(/admin_.*?_(\d+)$/);
    if (match) {
      const count = chats.findIndex(c => c.session_id === sessionId) + 1;
      return `Student ${count}`;
    }
    return sessionId;
  };

  const deleteChat = async (chatId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`https://mypupqcchatbot-production.up.railway.app/admin/direct-chats/${chatId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
      loadChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  return (
    <div className="direct-inquiries-wrapper">
      <div className="direct-inquiries-container">
        <div className="inquiries-header">
          <h2 className="inquiries-title">
            <svg className="inquiries-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Direct Inquiries
          </h2>
        </div>

        <div className="inquiries-content-wrapper">
          {/* Chat List */}
          <div className="inquiries-list-section">
            <div className="inquiries-list-header">
              <h3>Conversations ({chats.length})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="refresh-button" onClick={loadChats}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="inquiries-list">
              {chats.length === 0 ? (
                <div className="empty-state">
                  <p>No inquiries yet</p>
                </div>
              ) : (
                chats.map(chat => (
                  <div
                    key={chat.id}
                    className={`inquiry-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                    onClick={() => selectChat(chat)}
                  >
                    <div className="inquiry-item-header">
                      <div className="inquiry-user">
                        <div className="user-avatar">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="user-id">{formatSessionId(chat.session_id)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="inquiry-status" style={{ 
                          backgroundColor: chat.status === 'waiting' ? '#f59e0b' : '#10b981'
                        }}>
                          {chat.status}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this conversation?')) {
                              deleteChat(chat.id);
                            }
                          }}
                          style={{
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="inquiry-meta">
                      <span className="inquiry-time">{formatTime(chat.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="inquiry-chat-section">
            {!selectedChat ? (
              <div className="no-selection">
                <p>Select a conversation</p>
              </div>
            ) : (
              <>
                <div className="chat-header-bar">
                  <h3>{formatSessionId(selectedChat.session_id)}</h3>
                </div>

                <div className="inquiry-messages">
                  {loading ? (
                    <p>Loading...</p>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`message-container ${msg.sender_type}`}>
                        <div className={`message-bubble ${msg.sender_type}`}>
                          <p className="message-content">{msg.message}</p>
                          <span className="message-time">{formatTime(msg.sent_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="reply-input-section">
                  <textarea
                    className="reply-textarea"
                    placeholder="Type reply..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                  />
                  <button
                    className="send-reply-button"
                    onClick={sendReply}
                    disabled={!reply.trim()}
                  >
                    Send Reply
                  </button>
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