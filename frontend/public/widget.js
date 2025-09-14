(function() {
    'use strict';
    
    // Configuration
// In src/api.js, update the API_BASE_URL
    const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://mypupqcchatbot-production.up.railway.app/'  // Your live backend
    : 'http://localhost:8000';
    const WIDGET_ID = 'student-chatbot-widget';
    
    // Prevent multiple widget loads
    if (document.getElementById(WIDGET_ID)) {
        return;
    }
    
    // Generate session ID
    let sessionId = localStorage.getItem('student_chat_session');
    if (!sessionId) {
        sessionId = 'student_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('student_chat_session', sessionId);
    }
    
    // Widget HTML template
    const widgetHTML = `
        <div id="${WIDGET_ID}" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <!-- Chat Button -->
            <div id="chat-toggle" style="
                width: 60px; 
                height: 60px; 
                border-radius: 50%; 
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white; 
                border: none; 
                cursor: pointer; 
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                display: flex; 
                align-items: center; 
                justify-content: center;
                font-size: 24px;
                transition: all 0.3s ease;
                position: relative;
            ">
                <span id="chat-icon">💬</span>
                <span id="close-icon" style="display: none;">✕</span>
            </div>
            
            <!-- Chat Window -->
            <div id="chat-window" style="
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 350px;
                height: 500px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                display: none;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid #e5e7eb;
            ">
                <!-- Header -->
                <div style="
                    padding: 16px;
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    color: white;
                    border-radius: 12px 12px 0 0;
                ">
                    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Student Support</h3>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Ask me about academic information</p>
                </div>
                
                <!-- Messages Area -->
                <div id="chat-messages" style="
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    background: #f9fafb;
                    max-height: 350px;
                ">
                    <div style="
                        background: white;
                        padding: 12px;
                        border-radius: 8px;
                        margin-bottom: 12px;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    ">
                        <p style="margin: 0; font-size: 14px; color: #374151;">
                            Hi! I'm here to help with your academic questions. Ask me about courses, policies, deadlines, and more!
                        </p>
                    </div>
                </div>
                
                <!-- Input Area -->
                <div style="
                    padding: 16px;
                    border-top: 1px solid #e5e7eb;
                    background: white;
                ">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="chat-input" placeholder="Ask a question..." style="
                            flex: 1;
                            padding: 10px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 20px;
                            outline: none;
                            font-size: 14px;
                        ">
                        <button id="chat-send" style="
                            padding: 10px 16px;
                            background: #3b82f6;
                            color: white;
                            border: none;
                            border-radius: 20px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">Send</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add widget to page
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    
    // Get elements
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatIcon = document.getElementById('chat-icon');
    const closeIcon = document.getElementById('close-icon');
    
    let isOpen = false;
    
    // Toggle chat window
    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            chatWindow.style.display = 'flex';
            chatIcon.style.display = 'none';
            closeIcon.style.display = 'block';
            chatInput.focus();
        } else {
            chatWindow.style.display = 'none';
            chatIcon.style.display = 'block';
            closeIcon.style.display = 'none';
        }
    }
    
    // Add message to chat
    function addMessage(message, isUser = false, sources = null) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            margin-bottom: 12px;
            display: flex;
            justify-content: ${isUser ? 'flex-end' : 'flex-start'};
        `;
        
        const messageContent = document.createElement('div');
        messageContent.style.cssText = `
            max-width: 80%;
            padding: 10px 12px;
            border-radius: 12px;
            background: ${isUser ? '#3b82f6' : 'white'};
            color: ${isUser ? 'white' : '#374151'};
            font-size: 14px;
            line-height: 1.4;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        `;
        
        messageContent.textContent = message;
        
        // Add sources if available
        if (!isUser && sources && sources.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.style.cssText = `
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #e5e7eb;
                font-size: 11px;
                color: #6b7280;
            `;
            
            sourcesDiv.innerHTML = '<strong>Sources:</strong> ' + 
                sources.map(s => `${s.filename} (p. ${s.page})`).join(', ');
            
            messageContent.appendChild(sourcesDiv);
        }
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Show typing indicator
    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.style.cssText = `
            margin-bottom: 12px;
            display: flex;
            justify-content: flex-start;
        `;
        
        typingDiv.innerHTML = `
            <div style="
                background: white;
                padding: 10px 12px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <div style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #9ca3af;
                    animation: typing 1.4s infinite;
                "></div>
                <div style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #9ca3af;
                    animation: typing 1.4s infinite 0.2s;
                "></div>
                <div style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #9ca3af;
                    animation: typing 1.4s infinite 0.4s;
                "></div>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Remove typing indicator
    function hideTyping() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    // Send message
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message
        addMessage(message, true);
        chatInput.value = '';
        
        // Show typing
        showTyping();
        
        try {
            const response = await fetch(`${API_BASE_URL}/chat/student`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    session_id: sessionId
                })
            });
            
            const data = await response.json();
            
            hideTyping();
            
            if (response.ok) {
                addMessage(data.answer, false, data.sources);
            } else {
                addMessage('Sorry, I encountered an error. Please try again.', false);
            }
            
        } catch (error) {
            hideTyping();
            addMessage('Sorry, I\'m having trouble connecting. Please try again later.', false);
        }
    }
    
    // Event listeners
    chatToggle.addEventListener('click', toggleChat);
    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }
        
        #chat-toggle:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
        }
        
        #chat-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        #chat-send:hover {
            background: #2563eb;
        }
    `;
    document.head.appendChild(style);
    
})();
