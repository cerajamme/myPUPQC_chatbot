import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './FileUpload';
import DocumentList from './DocumentList';
import TestChat from './TestChat';
import Analytics from './Analytics';
import './DashboardStyles.css';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef(null);

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
      id: 'chat', 
      label: 'Test Chat',
      icon: (
        <svg className="navbar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
      {/* Navbar */}
      <nav className="dashboard-navbar">
        <div className="navbar-container">
          <div className="navbar-content">
            {/* Mobile menu button */}
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

            {/* Brand */}
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

              {/* Desktop Navigation */}
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

            {/* User menu */}
            <div className="navbar-user-menu">
              {/* Notifications */}
              <button className="notification-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Profile dropdown */}
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
                  <button className="profile-dropdown-item">Your Profile</button>
                  <button className="profile-dropdown-item">Settings</button>
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

        {/* Mobile menu */}
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

      {/* User Info Header */}
      <div className="dashboard-user-info">
        <div className="user-details">
          <h2>Student Chatbot Dashboard</h2>
          <p>Manage your chatbot and documents</p>
        </div>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {activeTab === 'upload' && <FileUpload />}
        {activeTab === 'documents' && <DocumentList />}
        {activeTab === 'chat' && <TestChat />}
        {activeTab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
};

export default Dashboard;