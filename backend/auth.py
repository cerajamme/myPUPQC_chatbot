from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from config import settings
from database import get_db
from models import User

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token security
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password for storing in database"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def verify_token(token: str, db: Session) -> Optional[User]:
    """Verify JWT token and return user"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None
    
    user = db.query(User).filter(User.email == email).first()
    return user

def authenticate_user(email: str, password: str, db: Session) -> Optional[User]:
    """Authenticate user with email and password"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user (for FastAPI dependencies)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    user = verify_token(credentials.credentials, db)
    if user is None:
        raise credentials_exception
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Require admin privileges"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

# Helper functions for user management
def create_user(email: str, password: str, full_name: str, db: Session, is_superuser: bool = False) -> User:
    """Create a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(password)
    user = User(
        email=email,
        hashed_password=hashed_password,
        full_name=full_name,
        is_superuser=is_superuser,
        is_active=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_last_login(user: User, db: Session):
    """Update user's last login time"""
    user.last_login = datetime.utcnow()
    db.commit()

def change_password(user: User, old_password: str, new_password: str, db: Session) -> bool:
    """Change user password"""
    if not verify_password(old_password, user.hashed_password):
        return False
    
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    return True

# Simple login function for the student chatbot admin
def login_admin(email: str, password: str, db: Session) -> dict:
    """Login admin user and return token"""
    user = authenticate_user(email, password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last login
    update_last_login(user, db)
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_superuser": user.is_superuser
        }
    }

# Quick setup function for development
def create_default_admin(db: Session) -> User:
    """Create default admin user for development"""
    try:
        return create_user(
            email="admin@student-bot.com",
            password="admin123",  # Change this!
            full_name="Admin User",
            db=db,
            is_superuser=True
        )
    except HTTPException:
        # User already exists
        return db.query(User).filter(User.email == "admin@student-bot.com").first()

# Token validation for public endpoints (optional)
def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get user if token is provided, otherwise return None"""
    if not credentials:
        return None
    
    try:
        user = verify_token(credentials.credentials, db)
        return user
    except:
        return None

if __name__ == "__main__":
    """Test password hashing"""
    test_password = "admin123"
    hashed = get_password_hash(test_password)
    print(f"Password: {test_password}")
    print(f"Hashed: {hashed}")
    print(f"Verification: {verify_password(test_password, hashed)}")
    
    # Test token creation
    token = create_access_token(data={"sub": "admin@student-bot.com"})
    print(f"Sample token: {token}")