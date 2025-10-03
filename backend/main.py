import os
import uuid
import logging
import asyncio
import re
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from fastapi.responses import FileResponse
from pathlib import Path
from models import User, Chatbot, Document as DocModel, Conversation, ChatbotType, ChatOption, PasswordResetToken, DirectChat, DirectMessage, DocumentChunk
# Local imports
from config import settings, validate_settings, get_upload_path, is_file_allowed, is_file_size_valid
from database import get_db, create_tables, create_initial_data, health_check, get_chatbot_by_type
from auth import login_admin, get_current_active_user, require_admin, get_password_hash
from models import User, Chatbot, Document as DocModel, Conversation, ChatbotType, ChatOption, PasswordResetToken
from email_service import get_email_service, PasswordResetService

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
    allow_origins=["*"],
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

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class VerifyTokenRequest(BaseModel):
    token: str

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

class DirectChatCreate(BaseModel):
    session_id: str
    user_ip: Optional[str] = None

class DirectChatResponse(BaseModel):
    id: int
    session_id: str
    status: str
    created_at: str
    last_activity: str

class DirectMessageCreate(BaseModel):
    message: str

class DirectMessageResponse(BaseModel):
    id: int
    sender_type: str
    message: str
    sent_at: str

class GetMessagesRequest(BaseModel):
    session_id: str
    last_seen: Optional[int] = 0

class UserMessageRequest(BaseModel):
    session_id: str
    message: str

# Helper function to clean bot responses
def clean_bot_response(response_text: str) -> str:
    """Clean bot response for natural conversation"""
    cleaned = response_text
    
    # Remove technical document references
    cleaned = re.sub(r'pages?\s+\d+(?:,\s*\d+)*(?:,?\s*and\s*\d+)?\s*of\s*[^.]*document[^.]*\.?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'Based on.*?from[^,]*,?\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\.pdf\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'according to the document\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Fix broken formatting
    cleaned = re.sub(r'\*\s*', '• ', cleaned)  # Convert asterisks to bullets
    cleaned = re.sub(r'\(\s*\)', '', cleaned)  # Remove empty parentheses
    cleaned = re.sub(r'&\s*\d+', '', cleaned)  # Remove stray references like "& 5"
    cleaned = re.sub(r'\s+', ' ', cleaned)     # Clean multiple spaces
    
    # Make tone more conversational
    cleaned = cleaned.replace('I don\'t have specific information about that in my current knowledge base', 
                            'I don\'t have details about that specific topic right now')
    
    return cleaned.strip()

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
        # Validate password length before any processing
        if len(request.password.encode('utf-8')) > 72:
            logger.warning(f"Password too long for login attempt: {request.email}")
            raise HTTPException(status_code=400, detail="Invalid credentials")
            
        result = login_admin(request.email, request.password, db)
        logger.info(f"Admin login successful: {request.email}")
        return result
    except HTTPException as e:
        logger.warning(f"Login failed for {request.email}: {e.detail}")
        raise e
    except ValueError as e:
        if "password cannot be longer than 72 bytes" in str(e):
            logger.warning(f"bcrypt password length error for {request.email}")
            raise HTTPException(status_code=400, detail="Invalid credentials")
        raise HTTPException(status_code=500, detail="Login system error")
    except Exception as e:
        logger.error(f"Login system error for {request.email}: {e}")
        raise HTTPException(status_code=500, detail="Login system error")

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


# Password Reset Endpoints
@app.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send password reset email"""
    try:
        email = request.email
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
                
        # Find user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="No account found with this email address")
        
        # Generate reset token
        reset_token = PasswordResetService.create_reset_token(user.id, db)
        
        # Send email
        email_service = get_email_service()
        success = await email_service.send_password_reset_email(email, reset_token, user.full_name)
        
        if success:
            logger.info(f"Password reset email sent to: {email}")
            return {"message": "Password reset email sent"}
        else:
            logger.error(f"Failed to send password reset email to: {email}")
            raise HTTPException(status_code=500, detail="Failed to send reset email")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send reset email")

@app.post("/auth/verify-reset-token")
async def verify_reset_token(request: VerifyTokenRequest, db: Session = Depends(get_db)):
    """Verify if reset token is valid"""
    try:
        token = request.token
        if not token:
            raise HTTPException(status_code=400, detail="Token is required")
        
        user_id = PasswordResetService.verify_reset_token(token, db)
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired token")
        
        return {"message": "Token is valid"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=500, detail="Token verification failed")

@app.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using token"""
    try:
        token = request.token
        new_password = request.new_password
        
        if not token or not new_password:
            raise HTTPException(status_code=400, detail="Token and new password are required")
        
        # Verify token
        user_id = PasswordResetService.verify_reset_token(token, db)
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired token")
        
        # Get user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update password - use hashed_password field
        user.hashed_password = get_password_hash(new_password)
        
        # Mark token as used
        PasswordResetService.mark_token_used(token, db)
        
        db.commit() 
        
        # Send confirmation email
        email_service = get_email_service()
        await email_service.send_password_changed_notification(user.email, user.full_name)
        
        logger.info(f"Password reset successful for user: {user.email}")
        return {"message": "Password reset successful"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to reset password")

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.put("/auth/profile")
async def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user profile information"""
    try:
        # Check if email is already taken by another user
        if request.email and request.email != current_user.email:
            existing_user = db.query(User).filter(
                User.email == request.email,
                User.id != current_user.id
            ).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Email already registered")
        
        # Update fields if provided
        if request.full_name:
            current_user.full_name = request.full_name.strip()
        if request.email:
            current_user.email = request.email.lower().strip()
        
        db.commit()
        
        return {
            "message": "Profile updated successfully",
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "full_name": current_user.full_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")

@app.put("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change user password with current password verification"""
    try:
        from auth import verify_password
        
        # Verify current password - use hashed_password field
        if not verify_password(request.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Update password - use hashed_password field
        current_user.hashed_password = get_password_hash(request.new_password)
        db.commit()
        
        # Send notification email
        email_service = get_email_service()
        await email_service.send_password_changed_notification(
            current_user.email, 
            current_user.full_name
        )
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")

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

# Widget JavaScript endpoint 
@app.get("/widget/student.js", response_class=PlainTextResponse)
async def serve_widget():
    """Serve widget JavaScript directly from code"""
    widget_js = """(function() {
    'use strict';
    
    const API_BASE_URL = 'https://mypupqcchatbot-production.up.railway.app';
    const WIDGET_ID = 'student-chatbot-widget';
    
    // Prevent multiple widget loads
    if (document.getElementById(WIDGET_ID)) {
        return;
    }
    
    // Generate session ID
    function generateSessionId() {
        return 'student_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    let sessionId = generateSessionId();
    let adminChatMode = false;
    let adminChatSessionId = null;
    let pollingInterval = null;
    let lastMessageId = 0;
    
    // Widget HTML template - PUPQC MAROON BRANDING
    const widgetHTML = '<div id="' + WIDGET_ID + '" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;"><div id="chat-toggle" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #7c2d12, #991b1b); color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(124, 45, 18, 0.4); display: flex; align-items: center; justify-content: center; font-size: 24px; transition: all 0.3s ease; position: relative;"><span id="chat-icon">💬</span><span id="close-icon" style="display: none;">✕</span></div><div id="chat-window" style="position: absolute; bottom: 80px; right: 0; width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15); display: none; flex-direction: column; overflow: hidden; border: 1px solid #e5e7eb;"><div style="padding: 16px; background: linear-gradient(135deg, #7c2d12, #991b1b); color: white; border-radius: 12px 12px 0 0;"><h3 style="margin: 0; font-size: 16px; font-weight: 600;">PUPQC Student Assistant</h3><p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Ask me about academic information</p></div><div id="chat-messages" style="flex: 1; padding: 16px; overflow-y: auto; background: #f9fafb; max-height: 350px;"><div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);"><p style="margin: 0; font-size: 14px; color: #374151;">Hello! I am your PUPQC Student Assistant. I can help you with academic questions, course information, policies, deadlines, and more. How can I assist you today?</p></div></div><div style="padding: 16px; border-top: 1px solid #e5e7eb; background: white;"><div style="display: flex; gap: 8px;"><input type="text" id="chat-input" placeholder="Ask me anything about PUPQC..." style="flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 20px; outline: none; font-size: 14px;"><button id="chat-send" style="padding: 10px 16px; background: #7c2d12; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 14px; font-weight: 500;">Send</button></div><div style="padding: 8px 0 0 0;"><button id="admin-chat-btn" style="width: 100%; padding: 8px 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 15px; font-size: 13px; color: #6b7280; cursor: pointer; transition: all 0.2s; font-family: inherit;">Need Human Help? Talk to Admin</button></div></div></div></div>';
    
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
    let optionsLoaded = false;
    
    // Fetch and display quick options
    async function loadQuickOptions() {
        if (optionsLoaded) return;
        
        try {
            const response = await fetch(API_BASE_URL + '/api/chat-options');
            const options = await response.json();
            
            if (options && options.length > 0) {
                displayQuickOptions(options.filter(opt => opt.is_active !== false));
            }
            optionsLoaded = true;
        } catch (error) {
            console.log('Could not load quick options:', error);
            optionsLoaded = true;
        }
    }
    
    function displayQuickOptions(options) {
        const optionsContainer = document.createElement('div');
        optionsContainer.id = 'quick-options';
        optionsContainer.style.cssText = 'margin: 12px 0; display: flex; flex-direction: column; gap: 8px;';
        
        const optionsHeader = document.createElement('div');
        optionsHeader.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px; font-weight: 500;';
        optionsContainer.appendChild(optionsHeader);
        
        options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option.label;
            button.style.cssText = 'padding: 10px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s; color: #374151; line-height: 1.3;';
            
            button.onmouseover = () => {
                button.style.background = '#e5e7eb';
                button.style.borderColor = '#9ca3af';
            };
            
            button.onmouseout = () => {
                button.style.background = '#f3f4f6';
                button.style.borderColor = '#d1d5db';
            };
            
            button.onclick = () => {
                addMessage(option.label, true);
                hideQuickOptions();
                showTyping();
                
                fetch(API_BASE_URL + '/chat/student', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: option.label,
                        session_id: sessionId
                    })
                }).then(response => response.json())
                .then(data => {
                    hideTyping();
                    if (data.answer) {
                        addMessage(data.answer, false);
                    }
                }).catch(error => {
                    hideTyping();
                    addMessage('Sorry, I encountered an error. Please try again.', false);
                });
            };
            
            optionsContainer.appendChild(button);
        });
        
        const welcomeMsg = chatMessages.querySelector('div');
        if (welcomeMsg) {
            welcomeMsg.insertAdjacentElement('afterend', optionsContainer);
        }
    }
    
    function hideQuickOptions() {
        const optionsContainer = document.getElementById('quick-options');
        if (optionsContainer) {
            optionsContainer.style.display = 'none';
        }
    }
    
    // Toggle chat window
    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            chatWindow.style.display = 'flex';
            chatIcon.style.display = 'none';
            closeIcon.style.display = 'block';
            chatInput.focus();
            loadQuickOptions();
        } else {
            chatWindow.style.display = 'none';
            chatIcon.style.display = 'block';
            closeIcon.style.display = 'none';
        }
    }
    
    // Add message to chat
    function addMessage(message, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: ' + (isUser ? 'flex-end' : 'flex-start') + ';';
        
        const messageContent = document.createElement('div');
        messageContent.style.cssText = 'max-width: 80%; padding: 10px 12px; border-radius: 12px; background: ' + (isUser ? '#7c2d12' : 'white') + '; color: ' + (isUser ? 'white' : '#374151') + '; font-size: 14px; line-height: 1.4; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);';
        
        messageContent.textContent = message;
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Show typing indicator
    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: flex-start;';
        
        typingDiv.innerHTML = '<div style="background: white; padding: 10px 12px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); display: flex; align-items: center; gap: 8px;"><div style="width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; animation: typing 1.4s infinite;"></div><div style="width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; animation: typing 1.4s infinite 0.2s;"></div><div style="width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; animation: typing 1.4s infinite 0.4s;"></div></div>';
        
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
    
    // Poll for admin responses - FIXED VERSION
    function startPollingForAdminResponse() {
        if (!adminChatMode || !adminChatSessionId) return;
        
        // Stop any existing polling first
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        
        pollingInterval = setInterval(async () => {
            try {
                const response = await fetch(API_BASE_URL + '/direct-chat/get-messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        session_id: adminChatSessionId,
                        last_seen: lastMessageId 
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    // Show new admin messages
                    data.new_messages?.forEach(msg => {
                        if (msg.sender_type === 'admin' && msg.id > lastMessageId) {
                            addMessage(msg.message, false);
                            lastMessageId = msg.id;
                        }
                    });
                }
            } catch (error) {
                console.log('Polling error:', error);
            }
        }, 3000);
        
        // Stop polling after 30 minutes
        setTimeout(() => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        }, 30 * 60 * 1000);
    }
    
    // Send message - FIXED VERSION
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        hideQuickOptions();
        addMessage(message, true);
        chatInput.value = '';   
        showTyping();
        
        try {
            let response;
            
            if (adminChatMode) {
                // Send to admin chat system
                response = await fetch(API_BASE_URL + '/direct-chat/user-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        session_id: adminChatSessionId,
                        message: message
                    })
                });
                
                const data = await response.json();
                hideTyping();
                
                if (response.ok) {
                    // Only show confirmation message for the first admin chat message
                    if (!window.adminFirstMessageSent) {
                        addMessage('Message sent to admin. Please wait for a response...', false);
                        window.adminFirstMessageSent = true;
                    }
                } else {
                    addMessage('Sorry, there was an error connecting to admin support.', false);
                }
            

            } else {
                // Send to AI system (existing code)
                response = await fetch(API_BASE_URL + '/chat/student', {
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
                    addMessage(data.answer, false);
                } else {
                    console.log('API Error:', data);
                    addMessage('Sorry, I encountered an error. Please try again.', false);
                }
            }
            
        } catch (error) {
            console.log('Widget connection error:', error);
            hideTyping();
            addMessage('Sorry, I am having trouble connecting. Please try again later.', false);
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

    // Admin chat button event listener - FIXED VERSION
    const adminChatBtn = document.getElementById('admin-chat-btn');
    if (adminChatBtn) {
        adminChatBtn.addEventListener('click', () => {
            adminChatMode = true;
            adminChatSessionId = 'admin_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            window.adminFirstMessageSent = false;

            chatMessages.innerHTML = '<div style="background: #fff7ed; padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #fed7aa;"><p style="margin: 0; font-size: 14px; color: #9a3412;">🔄 Connecting you with an admin...</p><p style="margin: 8px 0 0 0; font-size: 12px; color: #a16207;">Please wait while we connect you with a live administrator. You can start typing your message.</p></div>';
            
            adminChatBtn.style.display = 'none';
            chatInput.placeholder = 'Type your message to admin...';
            
            // Start polling once when admin chat begins
            startPollingForAdminResponse();
            
            console.log('Admin chat mode activated');
        });
    }
    
    // Add this after your other event listeners in the widget
    window.addEventListener('beforeunload', function() {
        if (adminChatMode && adminChatSessionId) {
            // Send a request to close the chat session
            fetch(API_BASE_URL + '/direct-chat/close-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    session_id: adminChatSessionId,
                    reason: 'user_left'
                }),
                keepalive: true  // Ensures request completes even if page closes
            }).catch(() => {}); // Silent fail if network issues
        }
    });

    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = '@keyframes typing { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-10px); } } #chat-toggle:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(124, 45, 18, 0.5); } #chat-input:focus { border-color: #7c2d12; box-shadow: 0 0 0 3px rgba(124, 45, 18, 0.1); } #chat-send:hover { background: #991b1b; } @media (max-width: 480px) { #' + WIDGET_ID + ' { bottom: 10px; right: 10px; } #chat-window { width: calc(100vw - 40px); height: calc(100vh - 140px); right: -10px; bottom: 80px; } }';
    document.head.appendChild(style);
    
})();"""
    return widget_js

# Direct Chat Endpoints
@app.post("/admin/direct-chats", response_model=DirectChatResponse)
async def create_direct_chat(
    request: DirectChatCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new direct chat session"""
    try:
        new_chat = DirectChat(
            session_id=request.session_id,
            user_ip=request.user_ip,
            status='waiting'
        )
        
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)
        
        return DirectChatResponse(
            id=new_chat.id,
            session_id=new_chat.session_id,
            status=new_chat.status,
            created_at=new_chat.created_at.isoformat(),
            last_activity=new_chat.last_activity.isoformat()
        )
    except Exception as e:
        logger.error(f"Error creating direct chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat session")

@app.get("/admin/direct-chats", response_model=List[DirectChatResponse])
async def list_direct_chats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List direct chats for admin"""
    try:
        chats = db.query(DirectChat).filter(
            DirectChat.status.in_(['waiting', 'active'])  # CHANGED: show active chats
        ).order_by(DirectChat.created_at.desc()).all()
        
        return [
            DirectChatResponse(
                id=chat.id,
                session_id=chat.session_id,
                status=chat.status,
                created_at=chat.created_at.isoformat(),
                last_activity=chat.last_activity.isoformat(),
                student_number=getattr(chat, 'student_number', None)  # ADD THIS
            )
            for chat in chats
        ]
    except Exception as e:
        logger.error(f"Error listing direct chats: {e}")
        return []

@app.post("/admin/direct-chats/{chat_id}/messages")
async def send_admin_message(
    chat_id: int,
    request: DirectMessageCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Send message from admin to user"""
    try:
        # Check if chat exists
        chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Create message
        new_message = DirectMessage(
            chat_id=chat_id,
            sender_type='admin',
            message=request.message
        )
        
        # Update chat status and last activity
        chat.status = 'active'
        chat.last_activity = datetime.utcnow()
        
        db.add(new_message)
        db.commit()
        
        return {"message": "Message sent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending admin message: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")

@app.post("/direct-chat/user-message")
async def send_user_message(
    request: UserMessageRequest,
    db: Session = Depends(get_db)
):
    """Send message from user to admin"""
    try:
        # Find or create chat session
        chat = db.query(DirectChat).filter(
            DirectChat.session_id == request.session_id
        ).first()
        
        if not chat:
            # Create new chat session
            chat = DirectChat(
                session_id=request.session_id,
                status='waiting'
            )
            db.add(chat)
            db.flush()
        
        # Create message
        new_message = DirectMessage(
            chat_id=chat.id,
            sender_type='user',
            message=request.message
        )
        
        # Update last activity
        chat.last_activity = datetime.utcnow()
        
        db.add(new_message)
        db.commit()
        
        return {"message": "Message sent to admin", "status": chat.status}
        
    except Exception as e:
        logger.error(f"Error sending user message: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send message")
@app.post("/direct-chat/get-messages")
async def get_user_messages(
    request: GetMessagesRequest,
    db: Session = Depends(get_db)
):
    """Get new messages for user (polling endpoint)"""
    try:
        session_id = request.session_id
        last_seen = request.last_seen
        
        chat = db.query(DirectChat).filter(
            DirectChat.session_id == session_id
        ).first()
        
        if not chat:
            return {"new_messages": []}
        
        # Get messages after last_seen
        messages = db.query(DirectMessage).filter(
            DirectMessage.chat_id == chat.id,
            DirectMessage.id > last_seen
        ).order_by(DirectMessage.sent_at.asc()).all()
        
        return {
            "new_messages": [
                {
                    "id": msg.id,
                    "sender_type": msg.sender_type,
                    "message": msg.message,
                    "sent_at": msg.sent_at.isoformat()
                }
                for msg in messages
            ]
        }
    except Exception as e:
        logger.error(f"Error getting user messages: {e}")
        return {"new_messages": []}
    
@app.delete("/admin/clear-closed-chats")
async def clear_closed_chats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete all closed chats and their messages"""
    try:
        # Delete messages first (foreign key constraint)
        closed_chat_ids = db.query(DirectChat.id).filter(DirectChat.status == 'closed').subquery()
        db.query(DirectMessage).filter(DirectMessage.chat_id.in_(closed_chat_ids)).delete(synchronize_session=False)
        
        # Then delete closed chats
        deleted_count = db.query(DirectChat).filter(DirectChat.status == 'closed').delete()
        db.commit()
        
        logger.info(f"Cleared {deleted_count} closed chats")
        return {"message": f"Cleared {deleted_count} closed chats"}
    except Exception as e:
        logger.error(f"Error clearing chats: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to clear chats")
    
@app.delete("/admin/direct-chats/{chat_id}")
async def delete_direct_chat(
    chat_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a specific chat and its messages"""
    try:
        # Delete messages first (foreign key constraint)
        db.query(DirectMessage).filter(DirectMessage.chat_id == chat_id).delete()
        # Then delete the chat
        deleted = db.query(DirectChat).filter(DirectChat.id == chat_id).delete()
        db.commit()
        
        if deleted:
            return {"message": "Chat deleted"}
        raise HTTPException(status_code=404, detail="Chat not found")
    except Exception as e:
        logger.error(f"Error deleting chat: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete chat")

    

@app.get("/admin/debug/chunks")
async def debug_chunks(
    search: Optional[str] = None,
    limit: int = 10,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """View actual chunk content from database"""
    query = db.query(DocumentChunk)
    
    if search:
        query = query.filter(DocumentChunk.text_content.ilike(f'%{search}%'))
    
    chunks = query.limit(limit).all()
    
    return {
        "total_chunks": db.query(DocumentChunk).count(),
        "search_term": search,
        "showing": len(chunks),
        "chunks": [
            {
                "id": c.id,
                "page": c.page_number,
                "text_preview": c.text_content[:500]
            }
            for c in chunks
        ]
    }


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
    

@app.post("/direct-chat/close-session")
async def close_chat_session(
    request: dict,
    db: Session = Depends(get_db)
):
    """Close chat session when user leaves"""
    try:
        session_id = request.get("session_id")
        reason = request.get("reason", "user_left")
        
        chat = db.query(DirectChat).filter(
            DirectChat.session_id == session_id
        ).first()
        
        if chat:
            # Update chat status to closed
            chat.status = 'closed'
            chat.last_activity = datetime.utcnow()
            
            # Add a system message for admin notification
            close_message = DirectMessage(
                chat_id=chat.id,
                sender_type='system',
                message=f'User has left the conversation (page refreshed/closed). Chat automatically closed.'
            )
            
            db.add(close_message)
            db.commit()
            
            logger.info(f"Chat session {session_id} closed - {reason}")
        
        return {"message": "Session closed"}
        
    except Exception as e:
        logger.error(f"Error closing chat session: {e}")
        return {"error": "Failed to close session"}

@app.get("/admin/test-gemini")
async def test_gemini_api(current_user: User = Depends(require_admin)):
    """Test Gemini API connection"""
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        response = model.generate_content("Say hello")
        
        return {
            "status": "success",
            "gemini_response": response.text,
            "api_key_present": bool(settings.gemini_api_key),
            "api_key_length": len(settings.gemini_api_key) if settings.gemini_api_key else 0
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__
        }

@app.get("/admin/list-gemini-models")
async def list_gemini_models(current_user: User = Depends(require_admin)):
    """List available Gemini models"""
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        
        models = genai.list_models()
        available = [
            {
                "name": m.name,
                "display_name": m.display_name,
                "supported_methods": m.supported_generation_methods
            }
            for m in models
        ]
        
        return {
            "status": "success",
            "available_models": available,
            "count": len(available)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
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