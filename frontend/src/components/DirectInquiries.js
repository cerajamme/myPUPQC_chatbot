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
    const interval = setInterval(loadActiveChats, 3000);
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
      const chats = response.data || [];
      
      // Filter out closed chats older than 5 minutes for auto-cleanup
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeChatsList = chats.filter(chat => {
        if (chat.status === 'closed') {
          const lastActivity = new Date(chat.last_activity);
          return lastActivity > fiveMinutesAgo;
        }
        return true;
      });
      
      setActiveChats(activeChatsList);
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
      loadChatMessages(selectedChat.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
  };

  const clearAllClosedChats = async () => {
    const openChats = activeChats.filter(chat => chat.status !== 'closed');
    setActiveChats(openChats);
    
    if (selectedChat && selectedChat.status === 'closed') {
      setSelectedChat(null);
      setMessages([]);
    }
  };

  if (loading) {
    return <div className="loading">Loading direct inquiries...</div>;
  }

  const closedChats = activeChats.filter(chat => chat.status === 'closed');

  return (
    <div style={{ display: 'flex', height: '600px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      
      {/* LEFT SIDE - Chat Interface */}
      <div style={{ 
        flex: '2', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'white',
        borderRight: '1px solid #e5e7eb'
      }}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div style={{ 
              padding: '16px', 
              borderBottom: '1px solid #e5e7eb', 
              background: '#f9fafb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>
                  Chat: {selectedChat.session_id.slice(0, 12)}...
                </h4>
                <span style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  background: selectedChat.status === 'waiting' ? '#fef3c7' : 
                             selectedChat.status === 'closed' ? '#e5e7eb' : '#d1fae5',
                  color: selectedChat.status === 'waiting' ? '#92400e' : 
                         selectedChat.status === 'closed' ? '#374151' : '#065f46'
                }}>
                  {selectedChat.status}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ 
              flex: 1, 
              padding: '16px', 
              overflowY: 'auto', 
              background: '#f9fafb'
            }}>
              {messages.map(message => (
                <div
                  key={message.id}
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: message.sender_type === 'admin' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    background: message.sender_type === 'admin' ? '#7c2d12' : 
                               message.sender_type === 'system' ? '#f3f4f6' : 'white',
                    color: message.sender_type === 'admin' ? 'white' : 
                           message.sender_type === 'system' ? '#6b7280' : '#374151',
                    fontSize: '14px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    border: message.sender_type === 'system' ? '1px dashed #d1d5db' : 'none'
                  }}>
                    <div>{message.message}</div>
                    <div style={{
                      fontSize: '11px',
                      opacity: 0.8,
                      marginTop: '4px'
                    }}>
                      {new Date(message.sent_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div style={{ 
              padding: '16px', 
              borderTop: '1px solid #e5e7eb', 
              background: 'white'
            }}>
              {selectedChat.status === 'closed' ? (
                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                  This conversation has been closed
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your response..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '20px',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    style={{
                      padding: '8px 16px',
                      background: '#7c2d12',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280'
          }}>
            <p>Select a chat to start responding</p>
          </div>
        )}
      </div>

      {/* RIGHT SIDE - Chat List */}
      <div style={{ 
        flex: '1', 
        display: 'flex', 
        flexDirection: 'column',
        background: '#f9fafb'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid #e5e7eb',
          background: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>
              Inquiries ({activeChats.length})
            </h3>
            {closedChats.length > 0 && (
              <button
                onClick={clearAllClosedChats}
                style={{
                  padding: '4px 8px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Clear ({closedChats.length})
              </button>
            )}
          </div>
        </div>

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {activeChats.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginTop: '20px' }}>
              No active inquiries
            </p>
          ) : (
            activeChats.map(chat => (
              <div
                key={chat.id}
                onClick={() => selectChat(chat)}
                style={{
                  padding: '12px',
                  marginBottom: '6px',
                  background: selectedChat?.id === chat.id ? '#7c2d12' : 
                             chat.status === 'closed' ? '#f3f4f6' : 'white',
                  color: selectedChat?.id === chat.id ? 'white' : 
                         chat.status === 'closed' ? '#6b7280' : '#374151',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '1px solid #e5e7eb',
                  opacity: chat.status === 'closed' ? 0.7 : 1,
                  fontSize: '13px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500' }}>
                    {chat.session_id.slice(0, 8)}...
                  </span>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    background: chat.status === 'waiting' ? '#fef3c7' : 
                               chat.status === 'closed' ? '#e5e7eb' : '#d1fae5',
                    color: chat.status === 'waiting' ? '#92400e' : 
                           chat.status === 'closed' ? '#374151' : '#065f46'
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
      </div>
    </div>
  );
};

export default DirectInquiries;