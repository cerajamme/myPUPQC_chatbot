import React, { useState, useEffect } from 'react';
import { admin } from '../api';
import './AnalyticsStyles.css'; 

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await admin.getAnalytics();
      setAnalytics(response.data);
      setError('');
    } catch (error) {
      setError('Failed to fetch analytics');
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
          Analytics
        </h2>
        <div style={{
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px'
        }}>
          <p style={{ fontSize: '14px', color: '#dc2626' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-wrapper">
      <div className="analytics-container">
        {/* Header */}
        <div className="analytics-header">
          <h2 className="analytics-title">
            <svg className="analytics-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Student Chatbot Analytics
          </h2>
          <button onClick={fetchAnalytics} className="refresh-button">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.357 2m-15.357-2H9" />
            </svg>
            Refresh
          </button>
        </div>
  
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value primary">{analytics?.total_conversations || 0}</div>
            <div className="stat-label">Total Conversations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value success">{analytics?.recent_conversations?.length || 0}</div>
            <div className="stat-label">Recent Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value warning">
              {analytics?.recent_conversations?.length > 0 
                ? Math.round(analytics.recent_conversations.reduce((sum, conv) => sum + (conv.response_time_ms || 0), 0) / analytics.recent_conversations.length)
                : 0}ms
            </div>
            <div className="stat-label">Avg Response Time</div>
          </div>
        </div>
        
        {/* Recent Conversations */}
        <div className="content-card">
          <h3 className="content-card-title">
            <svg className="content-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Recent Conversations
          </h3>
  
          {!analytics?.recent_conversations || analytics.recent_conversations.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="empty-title">No conversations yet</h3>
              <p className="empty-description">
                Start testing your chatbot to see analytics here
              </p>
            </div>
          ) : (
            <div className="conversations-list">
              {analytics.recent_conversations.map((conversation, index) => (
                <div key={index} className="conversation-item">
                  <div className="conversation-header">
                    <p className="conversation-question">{conversation.question}</p>
                    <div className="conversation-meta">
                      {conversation.response_time_ms && (
                        <span className="response-time-badge">{conversation.response_time_ms}ms</span>
                      )}
                      <span className="conversation-timestamp">{formatDate(conversation.created_at)}</span>
                    </div>
                  </div>
                  <p className="conversation-preview">
                    {conversation.question.length > 100 
                      ? `${conversation.question.substring(0, 100)}...` 
                      : conversation.question
                    }
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;