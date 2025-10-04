import React, { useState, useEffect, useRef } from 'react';
import TestChat from './TestChat';
import FileUpload from './FileUpload';
import DocumentList from './DocumentList';
import Analytics from './Analytics';
import './DashboardStyles.css';
import ProfileSettings from './ProfileSettings';
import DirectInquiries from './DirectInquiries';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadInquiries, setUnreadInquiries] = useState(0);
  const profileRef = useRef(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const notificationSound = useRef(null);
  const previousUnreadRef = useRef(0);

  // Initialize notification sound
  useEffect(() => {
    notificationSound.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Poll for unread inquiries
  useEffect(() => {
    const checkUnread = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('https://mypupqcchatbot-production.up.railway.app/admin/direct-chats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const waiting = Array.isArray(data) ? data.filter(c => c.status === 'waiting').length : 0;
        
        // Check if unread count increased (new inquiry)
        if (waiting > previousUnreadRef.current && previousUnreadRef.current > 0) {
          showNotification('New Direct Inquiry', 'A student has sent a new message');
          playSound();
        }
        
        previousUnreadRef.current = waiting;
        setUnreadInquiries(waiting);
        
        // Update browser tab title
        if (waiting > 0) {
          document.title = `(${waiting}) Admin Dashboard - PUPQC`;
        } else {
          document.title = 'Admin Dashboard - PUPQC';
        }
      } catch (error) {
        console.error('Error checking unread:', error);
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 5000);
    return () => clearInterval(interval);
  }, []);

  const showNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'direct-inquiry'
      });
      
      notification.onclick = () => {
        window.focus();
        setActiveTab('inquiries');
        notification.close();
      };
      
      setTimeout(() => notification.close(), 5000);
    }
  };

  const playSound = () => {
    if (notificationSound.current) {
      notificationSound.current.play().catch(e => console.log('Sound failed:', e));
    }
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleProfileMenu = () => {
    setProfileMenuOpen(!profileMenuOpen);
  };

  const getUserInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const tabs = [
    { 
      id: 'chat', 
      label: 'Test Chat',
      icon: (
        <svg className="navbar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    { 
      id: 'inquiries', 
      label: 'Direct Inquries',
      icon: (
        <svg className="navbar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    { 
      id: 'upload', 
      label: 'Upload Documents',
      icon: (
        <svg className="navbar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )
    },
    { 
      id: 'documents', 
      label: 'Documents',
      icon: (
        <svg className="navbar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    { 
      id: 'analytics', 
      label: 'Analytics',
      icon: (
        <svg className="navbar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="dashboard-container">
      <nav className="dashboard-navbar">
        <div className="navbar-container">
          <div className="navbar-content">
            <button 
              className="mobile-menu-button"
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            <div className="navbar-brand">
              <div className="navbar-logo">
                <img 
                  src="/mypupqcNavbar.png" 
                  alt="myPUPQC Logo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div 
                  style={{
                    display: 'none',
                    width: '2rem',
                    height: '2rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '0.25rem',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                >
                  PC
                </div>
              </div>

              <div className="navbar-nav-desktop">
                <div className="navbar-nav-list">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => handleNavClick(tab.id)}
                      className={`navbar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="navbar-user-menu">
              <button 
                className="notification-button" 
                style={{ position: 'relative' }}
                onClick={() => setActiveTab('inquiries')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {unreadInquiries > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#dc2626',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    minWidth: '18px',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {unreadInquiries}
                  </span>
                )}
              </button>

              <div className="profile-dropdown" ref={profileRef}>
                <button 
                  className="profile-button"
                  onClick={toggleProfileMenu}
                >
                  <div className="profile-avatar">
                    {getUserInitials(user?.full_name)}
                  </div>
                </button>

                <div className={`profile-dropdown-menu ${profileMenuOpen ? 'show' : ''}`}>
                  <div className="profile-dropdown-item">
                    <strong>{user?.full_name || 'Admin'}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {user?.email}
                    </div>
                  </div>
                  <hr style={{ margin: '0.25rem 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
                  <button 
                    className="profile-dropdown-item"
                    onClick={() => {
                      setShowProfileSettings(true);
                      setProfileMenuOpen(false);
                    }}
                  >
                    Account Settings
                  </button>
                  <button 
                    className="profile-dropdown-item"
                    onClick={onLogout}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`mobile-menu ${mobileMenuOpen ? 'show' : ''}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleNavClick(tab.id)}
              className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="dashboard-content">
        {activeTab === 'chat' && <TestChat />}
        {activeTab === 'inquiries' && <DirectInquiries />}
        {activeTab === 'upload' && <FileUpload />}
        {activeTab === 'documents' && <DocumentList />}
        {activeTab === 'analytics' && <Analytics />}
      </div>

      {showProfileSettings && (
        <ProfileSettings
          user={user}
          onUserUpdate={(updatedUser) => {
            console.log('User updated:', updatedUser);
          }}
          onClose={() => setShowProfileSettings(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;