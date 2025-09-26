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
              className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
              onClick={() => selectChat(chat)}
            >
              <div className="chat-status">
                <span className={`status-dot ${chat.status}`}></span>
                {chat.status === 'waiting' ? 'Waiting' : 'Active'}
              </div>
              <div className="chat-time">
                {new Date(chat.created_at).toLocaleTimeString()}
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