import React, { useState } from 'react';
import { auth } from '../api';
import './AuthStyles.css';

const ProfileSettings = ({ user, onUserUpdate, onClose }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || ''
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    return null;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await auth.updateProfile({
        full_name: profileForm.full_name.trim(),
        email: profileForm.email.trim()
      });

      setMessage('Profile updated successfully!');
      setMessageType('success');
      
      // Update user data in parent component
      if (onUserUpdate) {
        onUserUpdate(response.data.user);
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to update profile');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    // Validate new password
    const passwordError = validatePassword(passwordForm.new_password);
    if (passwordError) {
      setMessage(passwordError);
      setMessageType('error');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage('New passwords do not match');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await auth.changePassword(
        passwordForm.current_password,
        passwordForm.new_password
      );

      setMessage('Password changed successfully!');
      setMessageType('success');
      
      // Clear form
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to change password');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div className="profile-settings-overlay">
      <div className="profile-settings-modal">
        <div className="profile-settings-header">
          <h2>Account Settings</h2>
          <button onClick={onClose} className="close-button">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="profile-settings-tabs">
          <button
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile Information
          </button>
          <button
            className={`tab-button ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            Change Password
          </button>
        </div>

        <div className="profile-settings-content">
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

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="full_name" className="form-label">Full Name</label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={profileForm.full_name}
                  onChange={handleProfileChange}
                  className="form-input"
                  placeholder="Enter your full name"
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  className="form-input"
                  placeholder="Enter your email address"
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-button"
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Updating...
                  </>
                ) : (
                  'Update Profile'
                )}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="current_password" className="form-label">Current Password</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    id="current_password"
                    name="current_password"
                    value={passwordForm.current_password}
                    onChange={handlePasswordChange}
                    className="form-input"
                    placeholder="Enter current password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="password-toggle"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPasswords.current ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.75 6.75m3.128 3.128L12 12m-3.128-3.128L12 12m0 0l4.243 4.243M12 12L9.878 9.878" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="new_password" className="form-label">New Password</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    id="new_password"
                    name="new_password"
                    value={passwordForm.new_password}
                    onChange={handlePasswordChange}
                    className="form-input"
                    placeholder="Enter new password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="password-toggle"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPasswords.new ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.75 6.75m3.128 3.128L12 12m-3.128-3.128L12 12m0 0l4.243 4.243M12 12L9.878 9.878" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      )}
                    </svg>
                  </button>
                </div>
                {passwordForm.new_password && (
                  <div className="password-requirements">
                    <p>Password requirements:</p>
                    <ul>
                      <li className={passwordForm.new_password.length >= 8 ? 'valid' : ''}>At least 8 characters</li>
                      <li className={/(?=.*[a-z])/.test(passwordForm.new_password) ? 'valid' : ''}>One lowercase letter</li>
                      <li className={/(?=.*[A-Z])/.test(passwordForm.new_password) ? 'valid' : ''}>One uppercase letter</li>
                      <li className={/(?=.*\d)/.test(passwordForm.new_password) ? 'valid' : ''}>One number</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirm_password" className="form-label">Confirm New Password</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    id="confirm_password"
                    name="confirm_password"
                    value={passwordForm.confirm_password}
                    onChange={handlePasswordChange}
                    className="form-input"
                    placeholder="Confirm new password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="password-toggle"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPasswords.confirm ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.75 6.75m3.128 3.128L12 12m-3.128-3.128L12 12m0 0l4.243 4.243M12 12L9.878 9.878" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      )}
                    </svg>
                  </button>
                </div>
                {passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                  <p className="field-error">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !passwordForm.current_password || !passwordForm.new_password || passwordForm.new_password !== passwordForm.confirm_password}
                className="auth-button"
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Changing Password...
                  </>
                ) : (
                  'Change Password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;