import React, { useState, useEffect } from 'react';
import { admin } from '../api';
import './DashboardStyles.css';

const DirectInquiries = () => {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Load active chats on component mount
  useEffect(() => {
    loadActiveChats();
    const interval = setInterval(loadActiveChats, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      loadChatMessages(selectedChat.id);
      const interval = setInterval(() => loadChatMessages(selectedChat.id), 2000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  const loadActiveChats = async () => {
    try {
      const response = await admin.getDirectChats();
      setActiveChats(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading chats:', error);
      setLoading(false);
    }
  };

  const loadChatMessages = async (chatId) => {
    try {
      const response = await admin.getChatMessages(chatId);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      await admin.sendAdminMessage(selectedChat.id, newMessage);
      setNewMessage('');
      loadChatMessages(selectedChat.id); // Refresh messages
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    localStorage.setItem('selectedChatId', chat.id); // Persist across refreshes
  };

  if (loading) {
    return <div className="loading">Loading direct inquiries...</div>;
  }

  return (
    <div className="direct-inquiries">
      <div className="chat-sidebar">
        <h3>Direct Inquiries ({activeChats.length})</h3>
        {activeChats.length === 0 ? (
          <p className="no-chats">No active inquiries</p>
        ) : (
          activeChats.map(chat => (
            <div
              key={chat.id}
              onClick={() => selectChat(chat)}
              style={{
                padding: '12px',
                marginBottom: '8px',
                background: selectedChat?.id === chat.id ? '#7c2d12' : 
                           chat.status === 'closed' ? '#f3f4f6' : 'white',
                color: selectedChat?.id === chat.id ? 'white' : 
                       chat.status === 'closed' ? '#6b7280' : '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid #e5e7eb',
                opacity: chat.status === 'closed' ? 0.7 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '500' }}>
                  Session: {chat.session_id.slice(0, 8)}...
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: chat.status === 'waiting' ? '#fef3c7' : 
                             chat.status === 'closed' ? '#e5e7eb' :
                             '#d1fae5',
                  color: chat.status === 'waiting' ? '#92400e' : 
                         chat.status === 'closed' ? '#374151' :
                         '#065f46'
                }}>
                  {chat.status}
                </span>
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {new Date(chat.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-main">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <h4>Chat Session: {selectedChat.session_id.slice(0, 8)}...</h4>
              <span className={`status ${selectedChat.status}`}>
                {selectedChat.status}
              </span>
            </div>

            <div className="messages-container">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`message ${message.sender_type}`}
                >
                  <div className="message-content">
                    {message.message}
                  </div>
                  <div className="message-time">
                    {new Date(message.sent_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="message-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your response..."
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : (
          <div className="no-selection">
            <p>Select a chat to start responding</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectInquiries;