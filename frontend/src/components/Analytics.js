import React, { useState, useEffect } from 'react';
import { admin } from '../api';

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
          Student Chatbot Analytics
        </h2>
        <button 
          onClick={fetchAnalytics} 
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', margin: '0 0 8px 0' }}>
            {analytics?.total_conversations || 0}
          </h3>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Total Conversations</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669', margin: '0 0 8px 0' }}>
            {analytics?.recent_conversations?.length || 0}
          </h3>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Recent Sessions</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626', margin: '0 0 8px 0' }}>
            {analytics?.recent_conversations?.length > 0 
              ? Math.round(analytics.recent_conversations.reduce((sum, conv) => sum + (conv.response_time_ms || 0), 0) / analytics.recent_conversations.length)
              : 0}ms
          </h3>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Avg Response Time</p>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
          Recent Conversations
        </h3>

        {!analytics?.recent_conversations || analytics.recent_conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ color: '#6b7280', fontSize: '16px' }}>No conversations yet</p>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
              Start testing your chatbot to see analytics here
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {analytics.recent_conversations.map((conversation, index) => (
              <div key={index} style={{
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '12px',
                backgroundColor: '#fafafa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <p style={{ fontWeight: '500', color: '#1f2937', margin: 0, flex: 1 }}>
                    {conversation.question}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {conversation.response_time_ms && (
                      <span style={{
                        fontSize: '12px',
                        backgroundColor: '#f0f9ff',
                        color: '#0369a1',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {conversation.response_time_ms}ms
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {formatDate(conversation.created_at)}
                    </span>
                  </div>
                </div>
                
                <p style={{ 
                  fontSize: '14px', 
                  color: '#6b7280', 
                  margin: 0,
                  lineHeight: '1.4'
                }}>
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

      {/* Usage Tips */}
      <div className="card" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#0369a1' }}>
          Analytics Tips
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#0c4a6e' }}>
          <li style={{ marginBottom: '8px', fontSize: '14px' }}>
            Upload more documents to improve response quality and coverage
          </li>
          <li style={{ marginBottom: '8px', fontSize: '14px' }}>
            Monitor response times - consistently slow responses may indicate server issues
          </li>
          <li style={{ marginBottom: '8px', fontSize: '14px' }}>
            Review common questions to identify knowledge gaps in your documents
          </li>
          <li style={{ fontSize: '14px' }}>
            Test different question phrasings to ensure your chatbot handles various user inputs
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Analytics;