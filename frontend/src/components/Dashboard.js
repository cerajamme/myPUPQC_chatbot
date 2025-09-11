import React, { useState } from 'react';
import FileUpload from './FileUpload';
import DocumentList from './DocumentList';
import TestChat from './TestChat';
import Analytics from './Analytics';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('upload');

  const tabs = [
    { id: 'upload', label: 'Upload Documents' },
    { id: 'documents', label: 'Manage Documents' },
    { id: 'chat', label: 'Test Chat' },
    { id: 'analytics', label: 'Analytics' }
  ];

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
            Student Chatbot Dashboard
          </h1>
          <button onClick={onLogout} className="btn btn-danger">
            Logout
          </button>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px', marginBottom: '24px' }}>
          <p>Welcome, <strong>{user?.full_name || 'Admin'}</strong>!</p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>Email: {user?.email}</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                fontWeight: activeTab === tab.id ? '600' : '400'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && <FileUpload />}
        {activeTab === 'documents' && <DocumentList />}
        {activeTab === 'chat' && <TestChat />}
        {activeTab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
};

export default Dashboard;