import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './AuthStyles.css';
import {auth} from '../api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    const resetToken = searchParams.get('token');
    if (!resetToken) {
      setMessage('Invalid or missing reset token.');
      setMessageType('error');
      setCheckingToken(false);
      return;
    }

    setToken(resetToken);
    verifyToken(resetToken);
  }, [searchParams]);

  const verifyToken = async (resetToken) => {
    try {
      await auth.verifyResetToken(resetToken);
      setTokenValid(true);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Invalid or expired reset token.');
      setMessageType('error');
    } finally {
      setCheckingToken(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setMessage(passwordError);
      setMessageType('error');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await auth.resetPassword(token, formData.password);
      
      setMessage('Password reset successful! Redirecting to login...');
      setMessageType('success');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading-container">
            <div className="spinner large"></div>
            <p>Verifying reset token...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-circle error">
                <span className="logo-text">!</span>
              </div>
            </div>
            <h1 className="auth-title">Invalid Reset Link</h1>
            <p className="auth-subtitle">
              This password reset link is invalid or has expired.
            </p>
          </div>

          {message && (
            <div className={`message-card ${messageType}`}>
              <svg className="message-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="message-text">{message}</p>
            </div>
          )}

          <div className="auth-footer">
            <p>
              <Link to="/forgot-password" className="auth-link">
                Request a new reset link
              </Link>
              {' or '}
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
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password" className="form-label">New Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter new password"
                className="form-input"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.75 6.75m3.128 3.128L12 12m-3.128-3.128L12 12m0 0l4.243 4.243M12 12L9.878 9.878" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
              </button>
            </div>
            <div className="password-requirements">
              <p>Password must contain:</p>
              <ul>
                <li className={formData.password.length >= 8 ? 'valid' : ''}>At least 8 characters</li>
                <li className={/(?=.*[a-z])/.test(formData.password) ? 'valid' : ''}>One lowercase letter</li>
                <li className={/(?=.*[A-Z])/.test(formData.password) ? 'valid' : ''}>One uppercase letter</li>
                <li className={/(?=.*\d)/.test(formData.password) ? 'valid' : ''}>One number</li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                className="form-input"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="password-toggle"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showConfirmPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.75 6.75m3.128 3.128L12 12m-3.128-3.128L12 12m0 0l4.243 4.243M12 12L9.878 9.878" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="field-error">Passwords do not match</p>
            )}
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
            disabled={loading || !formData.password || !formData.confirmPassword || formData.password !== formData.confirmPassword}
            className="auth-button"
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Resetting Password...
              </>
            ) : (
              'Reset Password'
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

export default ResetPassword;