import os
import uuid
import logging
import asyncio
import re
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Local imports
from config import settings, validate_settings, get_upload_path, is_file_allowed, is_file_size_valid
from database import get_db, create_tables, create_initial_data, health_check, get_chatbot_by_type
from auth import login_admin, get_current_active_user, require_admin
from models import User, Chatbot, Document as DocModel, Conversation, ChatbotType, ChatOption

# Setup logging
logging.basicConfig(level=getattr(logging, settings.log_level))
logger = logging.getLogger(__name__)

# Validate configuration on startup
try:
    validate_settings()
    logger.info("Configuration validated")
except ValueError as e:
    logger.error(f"Configuration error: {e}")
    # Don't exit in production - let some features fail gracefully

# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None
)

# CORS middleware - Fixed to properly use dynamic allowed_origins
logger.info(f"CORS allowed origins: {settings.allowed_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Create uploads directory
os.makedirs(settings.upload_dir, exist_ok=True)

# Global RAG system instance (initialized lazily)
_rag_system = None

def get_rag_system():
    """Get or initialize RAG system lazily"""
    global _rag_system
    if _rag_system is None:
        try:
            from rag_system import get_student_rag
            _rag_system = get_student_rag()
            logger.info("RAG system initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize RAG system: {e}")
            # Return a mock RAG system for graceful degradation
            _rag_system = MockRAGSystem()
    return _rag_system

class MockRAGSystem:
    """Fallback RAG system when initialization fails"""
    def health_check(self):
        return {"status": "degraded", "error": "RAG system unavailable"}
    
    async def query_student_bot(self, question: str, session_id: str = None):
        return {
            "answer": "I'm sorry, the knowledge base is temporarily unavailable. Please try again later.",
            "sources": [],
            "response_time_ms": 0,
            "session_id": session_id
        }
    
    def get_student_documents(self):
        return []
    
    def delete_document(self, document_id: int):
        return False
    
    async def process_pdf(self, file_path: str, filename: str, chatbot_id: int):
        return {"status": "error", "message": "PDF processing unavailable"}

# Pydantic models for API
class LoginRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    response_time_ms: int
    session_id: Optional[str] = None

class DocumentInfo(BaseModel):
    id: int
    filename: str
    status: str
    pages: Optional[int]
    chunks: Optional[int]
    uploaded_at: Optional[str]
    processed_at: Optional[str]

class HealthResponse(BaseModel):
    status: str
    database: bool
    rag_system: Dict[str, Any]
    timestamp: str

# Pydantic models for chat options
class ChatOptionCreate(BaseModel):
    label: str
    order: Optional[int] = 0

class ChatOptionResponse(BaseModel):
    id: int
    label: str
    order: int
    is_active: bool
    created_at: str

# Helper function to clean bot responses
def clean_bot_response(response_text: str) -> str:
    """Clean bot response to remove PDF references and make it natural"""
    cleaned = response_text
    
    # Remove PDF references
    patterns_to_remove = [
        r'Based on the provided text from[^,]*,?\s*',
        r'Page \d+\s*-?\s*',
        r'\.pdf\b',
        r'according to the document\s*',
        r'from the document\s*',
        r'the document states\s*',
        r'as mentioned in the text\s*',
        r'the text indicates\s*',
        r'from the provided information\s*',
        r'based on the information provided\s*'
    ]
    
    for pattern in patterns_to_remove:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    # Replace document-specific language with natural language
    replacements = {
        'The document details': 'The information covers',
        'The document mentions': 'The information indicates',
        'According to the text': 'The information shows',
        'The provided text states': 'The information indicates'
    }
    
    for old, new in replacements.items():
        cleaned = re.sub(old, new, cleaned, flags=re.IGNORECASE)
    
    # Clean up extra whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    return cleaned

# Startup event - minimal and resilient
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup - keep minimal for fast startup"""
    logger.info("🚀 Starting Student Chatbot Platform...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Frontend URL: {settings.frontend_url}")
    logger.info(f"CORS origins: {settings.allowed_origins}")
    
    try:
        # Only do essential database setup
        if create_tables():
            logger.info("✅ Database tables ready")
            create_initial_data()
        else:
            logger.warning("⚠️ Database setup issues - some features may not work")
    except Exception as e:
        logger.error(f"❌ Database startup error: {e}")
        # Continue anyway - let health check endpoints reveal issues

# Root endpoint
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Student Chatbot Platform API",
        "version": settings.api_version,
        "status": "running",
        "environment": settings.environment,
        "docs": "/docs" if settings.debug else "disabled"
    }

# Simple ping endpoint for load balancer health checks
@app.get("/ping")
async def ping():
    """Simple health check that doesn't depend on heavy services"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_endpoint():
    """System health check"""
    try:
        rag = get_rag_system()
        return HealthResponse(
            status="healthy",
            database=health_check(),
            rag_system=rag.health_check(),
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return HealthResponse(
            status="degraded",
            database=False,
            rag_system={"status": "error", "message": str(e)},
            timestamp=datetime.utcnow().isoformat()
        )

# Authentication endpoints
@app.post("/auth/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Admin login endpoint"""
    try:
        result = login_admin(request.email, request.password, db)
        logger.info(f"Admin login successful: {request.email}")
        return result
    except HTTPException as e:
        logger.warning(f"Login failed for {request.email}")
        raise e

@app.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_superuser": current_user.is_superuser,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None
    }

# Student chatbot management endpoints
@app.get("/admin/student/info")
async def get_student_bot_info(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get student chatbot information"""
    student_bot = db.query(Chatbot).filter(Chatbot.type == ChatbotType.STUDENT).first()
    if not student_bot:
        raise HTTPException(status_code=404, detail="Student chatbot not found")
    
    return {
        "id": student_bot.id,
        "name": student_bot.name,
        "type": student_bot.type.value,
        "description": student_bot.description,
        "embed_code": student_bot.embed_code,
        "widget_title": student_bot.widget_title,
        "widget_color": student_bot.widget_color,
        "welcome_message": student_bot.welcome_message,
        "is_active": student_bot.is_active,
        "created_at": student_bot.created_at.isoformat()
    }

@app.post("/admin/student/upload")
async def upload_student_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Upload PDF document to student knowledge base"""
    
    # Validate file
    if not is_file_allowed(file.filename):
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Only {settings.allowed_extensions} are supported."
        )
    
    if not is_file_size_valid(file.size):
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb}MB."
        )
    
    # Get student chatbot
    student_bot = db.query(Chatbot).filter(Chatbot.type == ChatbotType.STUDENT).first()
    if not student_bot:
        raise HTTPException(status_code=404, detail="Student chatbot not found")
    
    # Save file
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = get_upload_path(unique_filename)
    
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Process PDF in background
        rag = get_rag_system()
        background_tasks.add_task(
            rag.process_pdf, 
            file_path, 
            file.filename, 
            student_bot.id
        )
        
        logger.info(f"PDF upload initiated: {file.filename}")
        
        return {
            "message": f"File {file.filename} uploaded successfully. Processing in background.",
            "filename": file.filename,
            "status": "processing"
        }
        
    except Exception as e:
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/admin/student/documents", response_model=List[DocumentInfo])
async def list_student_documents(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get list of documents - direct database query, bypasses RAG system"""
    try:
        # Get student chatbot
        student_bot = db.query(Chatbot).filter(Chatbot.type == ChatbotType.STUDENT).first()
        if not student_bot:
            logger.warning("Student chatbot not found")
            return []
        
        # Direct database query - no RAG dependency
        documents = db.query(DocModel).filter(
            DocModel.chatbot_id == student_bot.id
        ).all()
        
        logger.info(f"Found {len(documents)} documents in database")
        
        result = []
        for doc in documents:
            try:
                doc_info = DocumentInfo(
                    id=doc.id,
                    filename=doc.original_filename or doc.filename,
                    status=doc.status.value if hasattr(doc.status, 'value') else str(doc.status),
                    pages=doc.page_count,
                    chunks=doc.chunk_count,
                    uploaded_at=doc.created_at.isoformat() if doc.created_at else None,
                    processed_at=doc.processed_at.isoformat() if doc.processed_at else None
                )
                result.append(doc_info)
            except Exception as e:
                logger.error(f"Error processing document {doc.id}: {e}")
                continue
        
        return result
        
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        return []

@app.delete("/admin/student/documents/{document_id}")
async def delete_student_document(
    document_id: int,
    current_user: User = Depends(require_admin)
):
    """Delete document from student knowledge base"""
    rag = get_rag_system()
    success = rag.delete_document(document_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}

@app.post("/admin/student/test-chat", response_model=ChatResponse)
async def test_student_chat(
    request: ChatRequest,
    current_user: User = Depends(require_admin)
):
    """Test student chatbot with admin query - cleaned responses"""
    rag = get_rag_system()
    session_id = f"admin_test_{uuid.uuid4()}"
    
    result = await rag.query_student_bot(request.message, session_id)
    
    # Clean the response to remove PDF references
    cleaned_answer = clean_bot_response(result.get("answer", ""))
    
    return ChatResponse(
        answer=cleaned_answer,
        sources=[],  # Don't show sources in natural conversation
        response_time_ms=0,  # Don't show response time
        session_id=session_id
    )

# Public chat endpoint for embeddable widgets
@app.post("/chat/student", response_model=ChatResponse)
async def chat_with_student_bot(request: ChatRequest):
    """Public endpoint for student chat widget"""
    try:
        rag = get_rag_system()
        
        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())
        
        # Get response from RAG system
        result = await rag.query_student_bot(request.message, session_id)
        
        # Clean the response to remove PDF references
        cleaned_answer = clean_bot_response(result.get("answer", ""))
        
        logger.info(f"Student query answered: {request.message[:50]}...")
        return ChatResponse(
            answer=cleaned_answer,
            sources=[],  # Don't show sources in natural conversation
            response_time_ms=0,  # Don't show response time
            session_id=session_id
        )
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            answer="I'm sorry, I'm having trouble processing your question right now. Please try again later.",
            sources=[],
            response_time_ms=0,
            session_id=request.session_id
        )

# Chat options endpoints
@app.get("/api/chat-options", response_model=List[ChatOptionResponse])
async def get_chat_options(db: Session = Depends(get_db)):
    """Get active chat options for frontend"""
    try:
        options = db.query(ChatOption).filter(
            ChatOption.is_active == True
        ).order_by(ChatOption.order.asc(), ChatOption.created_at.asc()).all()
        
        return [
            ChatOptionResponse(
                id=option.id,
                label=option.label,
                order=option.order,
                is_active=option.is_active,
                created_at=option.created_at.isoformat()
            )
            for option in options
        ]
    except Exception as e:
        logger.error(f"Error fetching chat options: {e}")
        return []

@app.post("/api/admin/chat-options", response_model=ChatOptionResponse)
async def create_chat_option(
    option_data: ChatOptionCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new chat option"""
    try:
        new_option = ChatOption(
            label=option_data.label.strip(),
            order=option_data.order,
            is_active=True
        )
        
        db.add(new_option)
        db.commit()
        db.refresh(new_option)
        
        logger.info(f"Created chat option: {new_option.label}")
        
        return ChatOptionResponse(
            id=new_option.id,
            label=new_option.label,
            order=new_option.order,
            is_active=new_option.is_active,
            created_at=new_option.created_at.isoformat()
        )
    except Exception as e:
        logger.error(f"Error creating chat option: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat option")

@app.delete("/api/admin/chat-options/{option_id}")
async def delete_chat_option(
    option_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete chat option"""
    try:
        option = db.query(ChatOption).filter(ChatOption.id == option_id).first()
        if not option:
            raise HTTPException(status_code=404, detail="Chat option not found")
        
        db.delete(option)
        db.commit()
        
        logger.info(f"Deleted chat option: {option.label}")
        return {"message": "Chat option deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat option: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete chat option")

# Widget JavaScript endpoint - Fixed to use proper backend URL
@app.get("/widget/student.js", response_class=PlainTextResponse)
async def get_student_widget():
    """Serve student chat widget JavaScript"""
    # Use proper backend URL resolution
    base_url = (
        os.getenv("BACKEND_URL") or 
        os.getenv("RENDER_EXTERNAL_URL") or 
        "https://mypupqcchatbot-production.up.railway.app"
    )
    
    widget_js = f"""
(function() {{
    'use strict';
    
    const API_BASE_URL = '{base_url}';
    const WIDGET_ID = 'student-chatbot-widget';
    
    // Prevent multiple widget loads
    if (document.getElementById(WIDGET_ID)) {{
        return;
    }}
    
    // Generate session ID
    let sessionId = localStorage.getItem('student_chat_session');
    if (!sessionId) {{
        sessionId = 'student_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('student_chat_session', sessionId);
    }}
    
    // Widget HTML template
    const widgetHTML = `
        <div id="${{WIDGET_ID}}" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
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
    function toggleChat() {{
        isOpen = !isOpen;
        if (isOpen) {{
            chatWindow.style.display = 'flex';
            chatIcon.style.display = 'none';
            closeIcon.style.display = 'block';
            chatInput.focus();
        }} else {{
            chatWindow.style.display = 'none';
            chatIcon.style.display = 'block';
            closeIcon.style.display = 'none';
        }}
    }}
    
    // Add message to chat
    function addMessage(message, isUser = false) {{
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            margin-bottom: 12px;
            display: flex;
            justify-content: ${{isUser ? 'flex-end' : 'flex-start'}};
        `;
        
        const messageContent = document.createElement('div');
        messageContent.style.cssText = `
            max-width: 80%;
            padding: 10px 12px;
            border-radius: 12px;
            background: ${{isUser ? '#3b82f6' : 'white'}};
            color: ${{isUser ? 'white' : '#374151'}};
            font-size: 14px;
            line-height: 1.4;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            white-space: pre-wrap;
        `;
        
        messageContent.textContent = message;
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }}
    
    // Show typing indicator
    function showTyping() {{
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
    }}
    
    // Remove typing indicator
    function hideTyping() {{
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {{
            typingIndicator.remove();
        }}
    }}
    
    // Send message
    async function sendMessage() {{
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message
        addMessage(message, true);
        chatInput.value = '';
        
        // Show typing
        showTyping();
        
        try {{
            const response = await fetch(`${{API_BASE_URL}}/chat/student`, {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                }},
                body: JSON.stringify({{
                    message: message,
                    session_id: sessionId
                }})
            }});
            
            const data = await response.json();
            
            hideTyping();
            
            if (response.ok) {{
                addMessage(data.answer, false);
            }} else {{
                addMessage('Sorry, I encountered an error. Please try again.', false);
            }}
            
        }} catch (error) {{
            hideTyping();
            addMessage('Sorry, I\\'m having trouble connecting. Please try again later.', false);
        }}
    }}
    
    // Event listeners
    chatToggle.addEventListener('click', toggleChat);
    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {{
        if (e.key === 'Enter') {{
            sendMessage();
        }}
    }});
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes typing {{
            0%, 60%, 100% {{ transform: translateY(0); }}
            30% {{ transform: translateY(-10px); }}
        }}
        
        #chat-toggle:hover {{
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
        }}
        
        #chat-input:focus {{
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }}
        
        #chat-send:hover {{
            background: #2563eb;
        }}
    `;
    document.head.appendChild(style);
    
}})();
"""
    return widget_js


# Analytics endpoints
@app.get("/admin/student/analytics")
async def get_student_analytics(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get student chatbot analytics"""
    try:
        student_bot = db.query(Chatbot).filter(Chatbot.type == ChatbotType.STUDENT).first()
        if not student_bot:
            raise HTTPException(status_code=404, detail="Student chatbot not found")
        
        # Get recent conversations
        recent_conversations = db.query(Conversation).filter(
            Conversation.chatbot_id == student_bot.id
        ).order_by(Conversation.created_at.desc()).limit(10).all()
        
        # Basic analytics
        total_conversations = db.query(Conversation).filter(
            Conversation.chatbot_id == student_bot.id
        ).count()
        
        return {
            "total_conversations": total_conversations,
            "recent_conversations": [
                {
                    "question": conv.user_message[:100] + "..." if len(conv.user_message) > 100 else conv.user_message,
                    "response_time_ms": conv.response_time_ms,
                    "created_at": conv.created_at.isoformat()
                }
                for conv in recent_conversations
            ]
        }
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return {
            "total_conversations": 0,
            "recent_conversations": []
        }
    

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port,
        reload=False,  # Always False in production
        log_level="info"
    )