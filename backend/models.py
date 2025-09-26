from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from datetime import datetime
import uuid

Base = declarative_base()

# Simplified: Just student for now (can add others later)
class ChatbotType(str, enum.Enum):
    STUDENT = "student"
    # FACULTY = "faculty"  # Add later
    # GUEST = "guest"      # Add later

class DocumentStatus(str, enum.Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"

class User(Base):
    """Admin users who can manage the platform"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    reset_tokens = relationship("PasswordResetToken", back_populates="user")
    
    def __repr__(self):
        return f"<User(email='{self.email}', name='{self.full_name}')>"

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(100), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="reset_tokens")

class Chatbot(Base):
    """The three types of chatbots: Student, Faculty, Guest"""
    __tablename__ = "chatbots"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # "Student Support Bot"
    type = Column(Enum(ChatbotType), nullable=False, index=True)
    description = Column(Text, nullable=True)
    embed_code = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Customization settings
    widget_title = Column(String(255), default="Ask me anything!")
    widget_color = Column(String(7), default="#3B82F6")  # Hex color
    welcome_message = Column(Text, default="Hello! How can I help you today?")
    
    # Relationships
    documents = relationship("Document", back_populates="chatbot", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="chatbot", cascade="all, delete-orphan")
    analytics = relationship("Analytics", back_populates="chatbot", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Chatbot(name='{self.name}', type='{self.type}')>"

class Document(Base):
    """PDF documents uploaded to each chatbot"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    chatbot_id = Column(Integer, ForeignKey("chatbots.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    status = Column(Enum(DocumentStatus), default=DocumentStatus.UPLOADING, index=True)
    
    # Processing information
    page_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=True)
    processing_error = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    chatbot = relationship("Chatbot", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Document(filename='{self.original_filename}', status='{self.status}')>"

class DocumentChunk(Base):
    """Text chunks from processed documents (for LangChain integration)"""
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)  # Order within document
    text_content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=False)
    start_char = Column(Integer, nullable=True)  # Character position in original
    end_char = Column(Integer, nullable=True)
    
    # Vector embedding will be stored in pgvector via LangChain
    # We keep metadata here for references
    embedding_id = Column(String(255), nullable=True)  # LangChain vector ID
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    
    def __repr__(self):
        return f"<DocumentChunk(doc_id={self.document_id}, page={self.page_number})>"

class Conversation(Base):
    """Chat conversations for analytics and history"""
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    chatbot_id = Column(Integer, ForeignKey("chatbots.id"), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, index=True)  # Track user sessions
    user_message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    
    # Response metadata
    response_time_ms = Column(Integer, nullable=True)  # How long to generate response
    sources_used = Column(Text, nullable=True)  # JSON string of source chunks
    confidence_score = Column(Float, nullable=True)  # If available from model
    
    # User context
    user_ip = Column(String(45), nullable=True)  # For basic analytics
    user_agent = Column(String(500), nullable=True)
    referer_url = Column(String(500), nullable=True)  # Which website embedded the widget
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    chatbot = relationship("Chatbot", back_populates="conversations")
    
    def __repr__(self):
        return f"<Conversation(chatbot_id={self.chatbot_id}, session='{self.session_id[:8]}...')>"

class Analytics(Base):
    """Daily analytics aggregation for dashboard"""
    __tablename__ = "analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    chatbot_id = Column(Integer, ForeignKey("chatbots.id"), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Daily metrics
    total_queries = Column(Integer, default=0)
    unique_sessions = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, default=0.0)
    total_response_time_ms = Column(Integer, default=0)
    
    # Popular queries (JSON string)
    top_queries = Column(Text, nullable=True)  # JSON: [{"query": "...", "count": 5}, ...]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    chatbot = relationship("Chatbot", back_populates="analytics")
    
    def __repr__(self):
        return f"<Analytics(chatbot_id={self.chatbot_id}, date={self.date.date()})>"

# Optional: Feedback system for improving responses
class Feedback(Base):
    """User feedback on bot responses"""
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars or thumbs up/down
    feedback_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    conversation = relationship("Conversation")
    
    def __repr__(self):
        return f"<Feedback(conversation_id={self.conversation_id}, rating={self.rating})>"
    
class ChatOption(Base):
    """Dynamic chat options/quick questions for users"""
    __tablename__ = "chat_options"
    
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(255), nullable=False)  # "What are the requirements for Latin honors?"
    order = Column(Integer, default=0)  # For sorting options
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<ChatOption(label='{self.label[:50]}...', active={self.is_active})>"
    
class DirectChat(Base):
    """Direct chat sessions between users and admins"""
    __tablename__ = "direct_chats"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    user_ip = Column(String(45), nullable=True)
    status = Column(String(20), default='waiting', index=True)  # waiting, active, closed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    messages = relationship("DirectMessage", back_populates="chat", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<DirectChat(session_id='{self.session_id}', status='{self.status}')>"

class DirectMessage(Base):
    """Messages in direct chat sessions"""
    __tablename__ = "direct_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("direct_chats.id"), nullable=False, index=True)
    sender_type = Column(String(10), nullable=False, index=True)  # 'user' or 'admin'
    message = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    chat = relationship("DirectChat", back_populates="messages")
    
    def __repr__(self):
        return f"<DirectMessage(chat_id={self.chat_id}, sender='{self.sender_type}')>"