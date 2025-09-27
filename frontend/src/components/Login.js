import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
    
    // Debug logging
    console.log('Login attempt:', { 
      email, 
      passwordLength: password.length,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Check password length first
      if (password.length > 72) {
        throw new Error('Password is too long (max 72 characters)');
      }

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

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = 'Login failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || `Server error (${response.status})`;
          console.log('Error response data:', errorData);
        } catch (parseError) {
          console.log('Could not parse error response:', parseError);
          errorMessage = `Server error (${response.status})`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Login successful:', { user: data.user?.email });
      
      const { access_token, user } = data;
      
      if (!access_token) {
        throw new Error('No access token received');
      }
      
      localStorage.setItem('token', access_token);
      
      if (onLogin) {
        onLogin(user, access_token);
      }
    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack
      });
      
      // Provide user-friendly error messages
      let userMessage = error.message;
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        userMessage = 'Cannot connect to server. Please check your internet connection.';
      } else if (error.message.includes('CORS')) {
        userMessage = 'Server configuration issue. Please contact support.';
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        userMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message.includes('500')) {
        userMessage = 'Server error. Please try again later or contact support.';
      }
      
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Debug function to test server connection
  // const testConnection = async () => {
  //   try {
  //     console.log('Testing server connection...');
  //     const response = await fetch('https://mypupqcchatbot-production.up.railway.app/ping');
  //     const data = await response.json();
  //     console.log('Server ping response:', data);
  //     setError('Server connection test: ' + (response.ok ? 'SUCCESS' : 'FAILED'));
  //   } catch (error) {
  //     console.error('Connection test failed:', error);
  //     setError('Connection test failed: ' + error.message);
  //   }
  // };

  return (
    <div 
      className="login-container"
      style={{ backgroundImage: 'url(/login-bg.jpg)' }}
    >
      <div className="login-overlay"></div>
      
      <div className="login-form-wrapper">
        <div className="login-glass-card">
          <div className="login-logo-section">
            <div className="login-logo">
              <img src="/mypupqc-chatbot.png" alt="PC Logo" className="logo-img" />
            </div>

            <h1 className="login-title">myPUPQC.ai</h1>
            <h3 className="login-title">Chatbot System</h3>
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
              <Link 
                to="/forgot-password" 
                className="login-forgot-link"
              >
                Forgot password?
              </Link>
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
                  Logging in...
                </div>
              ) : (
                'Log In'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;