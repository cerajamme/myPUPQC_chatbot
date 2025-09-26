import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../api';
import './AuthStyles.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setMessage('Please enter your email address');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await auth.forgotPassword(email);
      
      setEmailSent(true);
      setMessage('Password reset email sent! Check your inbox.');
      setMessageType('success');
      
    } catch (error) {
      setMessage(error.response?.data?.detail || 'An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-circle">
                <span className="logo-text">PUPQC</span>
              </div>
            </div>
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
          </div>

          <div className="email-sent-content">
            <div className="email-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            
            <div className="instructions">
              <p>Click the link in the email to reset your password.</p>
              <p className="expiry-note">The link will expire in 15 minutes.</p>
            </div>

            <div className="resend-section">
              <p>Didn't receive the email?</p>
              <button 
                onClick={() => {
                  setEmailSent(false);
                  setMessage('');
                }}
                className="link-button"
              >
                Try again
              </button>
            </div>
          </div>

          <div className="auth-footer">
            <p>
              Remember your password?{' '}
              <Link to="/login" className="auth-link">
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-circle">
              <span className="logo-text">PUPQC</span>
            </div>
          </div>
          <h1 className="auth-title">Forgot Password?</h1>
          <p className="auth-subtitle">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="form-input"
              disabled={loading}
              required
            />
          </div>

          {message && (
            <div className={`message-card ${messageType}`}>
              <svg className="message-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {messageType === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                )}
              </svg>
              <p className="message-text">{message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="auth-button"
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Sending...
              </>
            ) : (
              'Send Reset Email'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Remember your password?{' '}
            <Link to="/login" className="auth-link">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;