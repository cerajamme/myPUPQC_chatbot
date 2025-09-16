from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from config import settings

engine = create_engine(
    settings.database_url.replace("postgresql://", "postgresql+psycopg://"),
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def health_check():
    """Simple health check"""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            return True
    except:
        return False

def get_chatbot_by_type(chatbot_type: str):
    """Get chatbot by type (student/faculty/guest)"""
    from models import Chatbot
    
    db = SessionLocal()
    try:
        chatbot = db.query(Chatbot).filter(
            Chatbot.type == chatbot_type,
            Chatbot.is_active == True
        ).first()
        return chatbot
    finally:
        db.close()

def create_tables():
    """Create tables - already done in main setup"""
    from models import Base
    Base.metadata.create_all(bind=engine)
    return True

def create_initial_data():
    """Create initial data - already done in main setup"""
    return True

def create_initial_chat_options(db: Session):
    """Create default chat options"""
    from models import ChatOption
    
    default_options = [
        "What are the requirements for Latin honors?",
        "How do I enroll for the next semester?", 
        "What financial aid options are available?"
    ]
    
    for i, label in enumerate(default_options):
        existing = db.query(ChatOption).filter(ChatOption.label == label).first()
        if not existing:
            option = ChatOption(label=label, order=i, is_active=True)
            db.add(option)
    
    db.commit()

if __name__ == "__main__":
    print("Setting up database...")
    
    # Import models (this registers them)
    from models import Base, User, Chatbot, ChatbotType, ChatOption
    from passlib.context import CryptContext
    
    # Create all tables
    Base.metadata.drop_all(bind=engine)  # Clean slate
    Base.metadata.create_all(bind=engine)
    print("Tables created!")
    
    # Create data
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = SessionLocal()
    
    try:
        admin = User(
            email="admin@example.com",
            hashed_password=pwd_context.hash("admin123"),
            full_name="Admin User",
            is_superuser=True,
            is_active=True
        )
        db.add(admin)
        
        import uuid
        student_bot = Chatbot(
            name="Student Support Bot",
            type=ChatbotType.STUDENT,
            description="Student support chatbot",
            embed_code=str(uuid.uuid4()),
            widget_title="Student Support",
            widget_color="#3B82F6",
            welcome_message="Hi! How can I help?",
            is_active=True
        )
        db.add(student_bot)
        
        # Create initial chat options
        create_initial_chat_options(db)
        
        db.commit()
        print("Setup complete!")
        print("Login: admin@example.com / admin123")
        
    except Exception as e:
        print(f"Error during setup: {e}")
        db.rollback()
    finally:
        db.close()