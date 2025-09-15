import React, { useState } from 'react';
import './LoginStyles.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('https://mypupqcchatbot-production.up.railway.app/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      const { access_token, user } = data;
      
      localStorage.setItem('token', access_token);
      
      if (onLogin) {
        onLogin(user, access_token);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = () => {
    alert('Forgot password functionality will be implemented soon.');
  };

  return (
    <div 
      className="login-container"
      style={{ backgroundImage: 'url(/login-bg.jpg)' }}
    >
      <div className="login-overlay"></div>
      
      <div className="login-form-wrapper">
        <div className="login-glass-card">
          <div className="login-logo-section">
            <div className="login-logo">PC</div>
            <h1 className="login-title">Welcome Back</h1>
            <div className="login-badge">Admin Portal</div>
          </div>

          <div className="login-form-container">
            <div className="login-form-group">
              <label className="login-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="login-form-group">
              <label className="login-label">Password</label>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input login-password-input"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="login-eye-button"
                >
                  {showPassword ? (
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error-box">
                <p className="login-error-text">{error}</p>
              </div>
            )}

            <div className="login-forgot-section">
              <button
                type="button"
                className="login-forgot-link"
                onClick={handleForgotPassword}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="login-button"
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="login-spinner"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="login-credentials-box">
              <p className="login-credentials-text">
                <strong>Default credentials:</strong>
                <br />
                admin@example.com / admin123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;