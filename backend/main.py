import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Local imports
from config import settings, validate_settings, get_upload_path, is_file_allowed, is_file_size_valid
from database import get_db, create_tables, create_initial_data, health_check, get_chatbot_by_type
from auth import login_admin, get_current_active_user, require_admin
from rag_system import get_student_rag
from models import User, Chatbot, Document as DocModel, Conversation, ChatbotType

# Setup logging
logging.basicConfig(level=getattr(logging, settings.log_level))
logger = logging.getLogger(__name__)

# Validate configuration on startup
try:
    validate_settings()
    logger.info("✅ Configuration validated")
except ValueError as e:
    logger.error(f"❌ Configuration error: {e}")
    exit(1)

# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None
)

# CORS middleware for embeddable widgets
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Create uploads directory
os.makedirs(settings.upload_dir, exist_ok=True)

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

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database and RAG system on startup"""
    logger.info("🚀 Starting Student Chatbot Platform...")
    
    # Create tables if they don't exist
    if create_tables():
        logger.info("✅ Database tables ready")
        create_initial_data()
    else:
        logger.error("❌ Database setup failed")
        return
    
    # Initialize RAG system
    try:
        rag = get_student_rag()
        health = rag.health_check()
        logger.info(f"✅ RAG system initialized: {health['status']}")
    except Exception as e:
        logger.error(f"❌ RAG system failed to initialize: {e}")

# Root endpoint
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Student Chatbot Platform API",
        "version": settings.api_version,
        "status": "running",
        "docs": "/docs" if settings.debug else "disabled"
    }

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_endpoint():
    """System health check"""
    rag = get_student_rag()
    return HealthResponse(
        status="healthy",
        database=health_check(),
        rag_system=rag.health_check(),
        timestamp=datetime.utcnow().isoformat()
    )

# Authentication endpoints
@app.post("/auth/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Admin login endpoint"""
    try:
        result = login_admin(request.email, request.password, db)
        logger.info(f"✅ Admin login successful: {request.email}")
        return result
    except HTTPException as e:
        logger.warning(f"❌ Login failed for {request.email}")
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
        rag = get_student_rag()
        background_tasks.add_task(
            rag.process_pdf, 
            file_path, 
            file.filename, 
            student_bot.id
        )
        
        logger.info(f"📄 PDF upload initiated: {file.filename}")
        
        return {
            "message": f"File {file.filename} uploaded successfully. Processing in background.",
            "filename": file.filename,
            "status": "processing"
        }
        
    except Exception as e:
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f"❌ Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/admin/student/documents", response_model=List[DocumentInfo])
async def list_student_documents(current_user: User = Depends(require_admin)):
    """Get list of documents in student knowledge base"""
    rag = get_student_rag()
    documents = rag.get_student_documents()
    return [DocumentInfo(**doc) for doc in documents]

@app.delete("/admin/student/documents/{document_id}")
async def delete_student_document(
    document_id: int,
    current_user: User = Depends(require_admin)
):
    """Delete document from student knowledge base"""
    rag = get_student_rag()
    success = rag.delete_document(document_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}

@app.post("/admin/student/test-chat", response_model=ChatResponse)
async def test_student_chat(
    request: ChatRequest,
    current_user: User = Depends(require_admin)
):
    """Test student chatbot with admin query"""
    rag = get_student_rag()
    session_id = f"admin_test_{uuid.uuid4()}"
    
    result = await rag.query_student_bot(request.message, session_id)
    return ChatResponse(**result)

# Public chat endpoint for embeddable widgets
@app.post("/chat/student", response_model=ChatResponse)
async def chat_with_student_bot(request: ChatRequest):
    """Public endpoint for student chat widget"""
    try:
        rag = get_student_rag()
        
        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())
        
        # Get response from RAG system
        result = await rag.query_student_bot(request.message, session_id)
        
        logger.info(f"💬 Student query answered: {request.message[:50]}...")
        return ChatResponse(**result)
        
    except Exception as e:
        logger.error(f"❌ Chat error: {e}")
        return ChatResponse(
            answer="I'm sorry, I'm having trouble processing your question right now. Please try again later.",
            sources=[],
            response_time_ms=0,
            session_id=request.session_id
        )

# Widget JavaScript endpoint
@app.get("/widget/student.js", response_class=PlainTextResponse)
async def get_student_widget():
    """Serve student chat widget JavaScript"""
    widget_js = f"""
(function() {{
    // Student Chat Widget v{settings.api_version}
    const CHAT_API_URL = '{request.url_for("chat_with_student_bot").replace("student", "student")}';
    const WIDGET_TITLE = '{settings.student_widget_title}';
    const WELCOME_MESSAGE = '{settings.student_welcome_message}';
    
    let sessionId = localStorage.getItem('student_chat_session') || generateSessionId();
    localStorage.setItem('student_chat_session', sessionId);
    
    function generateSessionId() {{
        return 'student_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }}
    
    function createWidget() {{
        const widget = document.createElement('div');
        widget.id = 'student-chat-widget';
        widget.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
                <div id="chat-button" style="
                    width: 60px; height: 60px; border-radius: 50%; 
                    background: #3B82F6; color: white; border: none; 
                    cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 24px;
                ">💬</div>
                <div id="chat-window" style="
                    position: absolute; bottom: 70px; right: 0;
                    width: 350px; height: 500px; background: white;
                    border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    display: none; flex-direction: column;
                ">
                    <div style="padding: 15px; background: #3B82F6; color: white; border-radius: 12px 12px 0 0;">
                        <h3 style="margin: 0; font-size: 16px;">${{WIDGET_TITLE}}</h3>
                    </div>
                    <div id="chat-messages" style="
                        flex: 1; padding: 15px; overflow-y: auto; 
                        background: #f9fafb;
                    ">
                        <div style="background: #e5e7eb; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                            ${{WELCOME_MESSAGE}}
                        </div>
                    </div>
                    <div style="padding: 15px; border-top: 1px solid #e5e7eb;">
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="chat-input" placeholder="Ask about student services..." 
                                style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                            <button id="chat-send" style="
                                padding: 8px 15px; background: #3B82F6; color: white; 
                                border: none; border-radius: 6px; cursor: pointer;
                            ">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Event listeners
        const chatButton = document.getElementById('chat-button');
        const chatWindow = document.getElementById('chat-window');
        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');
        const chatMessages = document.getElementById('chat-messages');
        
        chatButton.addEventListener('click', () => {{
            chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
        }});
        
        async function sendMessage() {{
            const message = chatInput.value.trim();
            if (!message) return;
            
            // Add user message
            addMessage(message, 'user');
            chatInput.value = '';
            
            // Add typing indicator
            const typingDiv = addMessage('Typing...', 'bot', true);
            
            try {{
                const response = await fetch(CHAT_API_URL, {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ message, session_id: sessionId }})
                }});
                
                const data = await response.json();
                
                // Remove typing indicator
                typingDiv.remove();
                
                // Add bot response
                let botMessage = data.answer;
                if (data.sources && data.sources.length > 0) {{
                    botMessage += '\\n\\n📚 Sources: ' + 
                        data.sources.map(s => `Page ${{s.page}}`).join(', ');
                }}
                addMessage(botMessage, 'bot');
                
            }} catch (error) {{
                typingDiv.remove();
                addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            }}
        }}
        
        function addMessage(text, sender, isTyping = false) {{
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                margin-bottom: 10px; padding: 10px; border-radius: 8px;
                background: ${{sender === 'user' ? '#3B82F6' : '#e5e7eb'}};
                color: ${{sender === 'user' ? 'white' : 'black'}};
                margin-left: ${{sender === 'user' ? '20px' : '0'}};
                margin-right: ${{sender === 'user' ? '0' : '20px'}};
                white-space: pre-wrap;
            `;
            messageDiv.textContent = text;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return messageDiv;
        }}
        
        chatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {{
            if (e.key === 'Enter') sendMessage();
        }});
    }}
    
    // Initialize widget when DOM is ready
    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', createWidget);
    }} else {{
        createWidget();
    }}
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )