# email_service.py
import smtplib
import logging
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, PasswordResetToken
from config import settings


logger = logging.getLogger(__name__)

class EmailService:
    """Email service for sending password reset and verification emails"""
        
    def __init__(self):
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.username = settings.smtp_username
        self.password = settings.smtp_password
        self.from_email = settings.smtp_from_email
        self.from_name = settings.smtp_from_name
    
    def _create_message(self, to_email: str, subject: str, html_content: str, text_content: str = None) -> MIMEMultipart:
        """Create email message"""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email
        
        # Add text version if provided
        if text_content:
            text_part = MIMEText(text_content, 'plain')
            msg.attach(text_part)
        
        # Add HTML version
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        return msg
    
    async def _send_email(self, to_email: str, subject: str, html_content: str, text_content: str = None):
        """Send email using SMTP"""
        try:
            # Create message
            msg = self._create_message(to_email, subject, html_content, text_content)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    async def send_password_reset_email(self, to_email: str, reset_token: str, user_name: str = None):
        """Send password reset email with secure link"""
        
        # Your frontend URL - update this to match your frontend
        frontend_url = "http://localhost:3000"  # Change this to your actual frontend URL
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        
        display_name = user_name or "User"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset - PUPQC Student Assistant</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #7c2d12, #991b1b); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">PUPQC Student Assistant</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Password Reset Request</p>
            </div>
            
            <!-- Content -->
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1f2937; margin-top: 0;">Hello {display_name},</h2>
                
                <p>We received a request to reset your password for your PUPQC Student Assistant account.</p>
                
                <p>Click the button below to reset your password:</p>
                
                <!-- Reset Button -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" 
                       style="display: inline-block; background: #7c2d12; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Reset My Password
                    </a>
                </div>
                
                <p>Or copy and paste this link in your browser:</p>
                <p style="background: #e5e7eb; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 14px;">
                    {reset_url}
                </p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #d1d5db;">
                    <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">
                        <strong>Important:</strong> This link will expire in 15 minutes for security reasons.
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">
                        If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                    </p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
                <p>This email was sent by PUPQC Student Assistant</p>
                <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
            </div>
            
        </body>
        </html>
        """
        
        # Text version for email clients that don't support HTML
        text_content = f"""
        PUPQC Student Assistant - Password Reset
        
        Hello {display_name},
        
        We received a request to reset your password for your PUPQC Student Assistant account.
        
        Click or copy this link to reset your password:
        {reset_url}
        
        This link will expire in 15 minutes for security reasons.
        
        If you didn't request this password reset, please ignore this email.
        
        Thank you,
        PUPQC Student Assistant Team
        """
        
        subject = "Reset Your PUPQC Student Assistant Password"
        
        return await self._send_email(to_email, subject, html_content, text_content)
    
    async def send_password_changed_notification(self, to_email: str, user_name: str = None):
        """Send notification when password is successfully changed"""
        
        display_name = user_name or "User"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Changed - PUPQC Student Assistant</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #065f46, #059669); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">PUPQC Student Assistant</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Password Changed Successfully</p>
            </div>
            
            <!-- Content -->
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1f2937; margin-top: 0;">Hello {display_name},</h2>
                
                <p>Your password has been successfully changed for your PUPQC Student Assistant account.</p>
                
                <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p style="margin: 0; color: #047857;">
                        <strong>✓ Password Updated:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
                    </p>
                </div>
                
                <p>If you didn't make this change, please contact our support team immediately.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #d1d5db;">
                    <p style="color: #6b7280; font-size: 14px;">
                        For security reasons, you'll need to log in again with your new password.
                    </p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
                <p>This email was sent by PUPQC Student Assistant</p>
            </div>
            
        </body>
        </html>
        """
        
        subject = "Password Changed - PUPQC Student Assistant"
        
        return await self._send_email(to_email, subject, html_content)

# Password Reset Token Management
class PasswordResetService:
    """Service for managing password reset tokens"""
    
    @staticmethod
    def generate_reset_token() -> str:
        """Generate secure random token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def create_reset_token(user_id: int, db: Session) -> str:
        """Create and store password reset token"""
        # Delete existing tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user_id
        ).delete()
        
        # Generate new token
        token = PasswordResetService.generate_reset_token()
        expires_at = datetime.utcnow() + timedelta(minutes=15)  # 15 minutes expiry
        
        # Store token
        reset_token = PasswordResetToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        db.add(reset_token)
        db.commit()
        
        return token
    
    @staticmethod
    def verify_reset_token(token: str, db: Session) -> Optional[int]:
        """Verify reset token and return user_id if valid"""
        reset_token = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token,
            PasswordResetToken.expires_at > datetime.utcnow(),
            PasswordResetToken.used == False
        ).first()
        
        return reset_token.user_id if reset_token else None
    
    @staticmethod
    def mark_token_used(token: str, db: Session):
        """Mark reset token as used"""
        reset_token = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token
        ).first()
        
        if reset_token:
            reset_token.used = True
            db.commit()

# Global email service instance
email_service = None

def get_email_service() -> EmailService:
    """Get or create email service instance"""
    global email_service
    if email_service is None:
        email_service = EmailService()
    return email_service