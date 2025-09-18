import os
from typing import Optional, List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings with student-focused defaults"""
    
    # Database Configuration - from environment
    database_url: str = os.getenv("DATABASE_URL", "postgresql://localhost/chatbot_dev")
    
    # AI Configuration - from environment
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    
    # Security - from environment
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    
    # File Upload Settings
    upload_dir: str = os.getenv("UPLOAD_DIR", "uploads")
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    allowed_extensions: List[str] = [".pdf"]
    
    # Student Chatbot Settings
    student_bot_name: str = os.getenv("STUDENT_BOT_NAME", "Student Support Bot")
    student_widget_title: str = os.getenv("STUDENT_WIDGET_TITLE", "Ask Student Support")
    student_welcome_message: str = os.getenv("STUDENT_WELCOME_MESSAGE", "Hi! I'm here to help with your academic questions. Ask me about courses, policies, deadlines, and more!")
    
    # RAG Configuration  
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "500"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "50"))
    similarity_top_k: int = int(os.getenv("SIMILARITY_TOP_K", "5"))
    
    # LangChain Settings
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    vectorstore_collection: str = os.getenv("VECTORSTORE_COLLECTION", "student_documents")
    
    # API Settings
    api_title: str = os.getenv("API_TITLE", "Student Chatbot Platform")
    api_version: str = os.getenv("API_VERSION", "1.0.0")
    api_description: str = os.getenv("API_DESCRIPTION", "RAG-powered chatbot platform for student support")
    
    # URLs - Fixed fields
    frontend_url: str = os.getenv("FRONTEND_URL", "")
    widget_domain: str = os.getenv("WIDGET_DOMAIN", "")
    
    # Rate Limiting
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
    
    # Analytics
    analytics_enabled: bool = os.getenv("ANALYTICS_ENABLED", "true").lower() == "true"
    track_user_sessions: bool = os.getenv("TRACK_USER_SESSIONS", "true").lower() == "true"
    
    # Environment Settings
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    
    # CORS Settings - FIXED to properly parse comma-separated domains
    @property
    def allowed_origins(self) -> List[str]:
        """Generate allowed origins dynamically, filtering out empty values"""
        origins = [
            "http://localhost:3000",
            "http://localhost:8000",
        ]
        
        # Add frontend URL if set
        if self.frontend_url:
            origins.append(self.frontend_url)
        
        # Parse widget domain as comma-separated list
        if self.widget_domain:
            for domain in self.widget_domain.split(','):
                domain = domain.strip()
                if domain == '*':
                    origins.append('*')
                elif domain and not domain.startswith('http'):
                    origins.extend([f"http://{domain}", f"https://{domain}"])
                elif domain:
                    origins.append(domain)
        
        # Remove duplicates and empty strings
        return list(filter(None, set(origins)))
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create global settings instance
settings = Settings()

# Helper functions for common operations
def get_upload_path(filename: str) -> str:
    """Get full path for uploaded file"""
    os.makedirs(settings.upload_dir, exist_ok=True)
    return os.path.join(settings.upload_dir, filename)

def is_file_allowed(filename: str) -> bool:
    """Check if file extension is allowed"""
    file_ext = os.path.splitext(filename)[1].lower()
    return file_ext in settings.allowed_extensions

def get_file_size_mb(file_size_bytes: int) -> float:
    """Convert bytes to MB"""
    return file_size_bytes / (1024 * 1024)

def is_file_size_valid(file_size_bytes: int) -> bool:
    """Check if file size is within limits"""
    return get_file_size_mb(file_size_bytes) <= settings.max_file_size_mb

# Default prompts for the student chatbot
STUDENT_SYSTEM_PROMPT = """
You are a friendly PUPQC student support assistant. Use the provided context from student documents to answer questions naturally and conversationally.

Guidelines:
- Answer based on the provided context from official student documents
- Write in a natural, conversational tone like a helpful student assistant
- Never mention page numbers, document names, or technical references
- If you don't have enough information, say you're still learning about that topic
- Keep answers clear, friendly, and helpful for students
- Focus on academic policies, procedures, and student services
- Use bullet points or numbered lists when presenting multiple items

Context: {context}

Question: {question}

Please provide a helpful, natural answer without technical references:
"""

# Validation settings for different environments
def validate_settings():
    """Validate critical settings are properly configured"""
    errors = []
    
    if not settings.database_url or "localhost" in settings.database_url:
        if settings.environment == "production":
            errors.append("DATABASE_URL must be set for production")
    
    if not settings.gemini_api_key:
        errors.append("GEMINI_API_KEY must be set")
    
    if settings.secret_key == "dev-secret-key-change-in-production":
        if settings.environment == "production":
            errors.append("SECRET_KEY must be changed in production")
    
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")
    
    return True

# Environment-specific configurations
def get_environment():
    """Detect environment based on settings"""
    return settings.environment

if __name__ == "__main__":
    """Run this to validate your configuration"""
    try:
        validate_settings()
        print("✅ Configuration is valid!")
        print(f"🌍 Environment: {get_environment()}")
        print(f"📊 Database: {settings.database_url[:50]}...")
        print(f"🤖 AI Model: {settings.embedding_model}")
        print(f"📁 Upload dir: {settings.upload_dir}")
        print(f"📏 Max file size: {settings.max_file_size_mb}MB")
        print(f"🎯 Student bot: {settings.student_bot_name}")
        print(f"🔗 Allowed origins: {settings.allowed_origins}")
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        print("\n🔧 Please check your .env file or environment variables")