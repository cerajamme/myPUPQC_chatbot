import React, { useState, useEffect } from 'react';
import { admin } from '../api';

const DocumentList = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await admin.getDocuments();
      setDocuments(response.data);
      setError('');
    } catch (error) {
      setError('Failed to fetch documents');
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      setDeleting(documentId);
      await admin.deleteDocument(documentId);
      setDocuments(documents.filter(doc => doc.id !== documentId));
    } catch (error) {
      setError('Failed to delete document');
      console.error('Error deleting document:', error);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return '#059669';
      case 'processing': return '#d97706';
      case 'failed': return '#dc2626';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading documents...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
          Document Management
        </h2>
        <button 
          onClick={fetchDocuments} 
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          <p style={{ fontSize: '14px', color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>No documents uploaded yet</p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
            Upload PDF documents to get started with your chatbot
          </p>
        </div>
      ) : (
        <div style={{ overflow: 'hidden', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Document
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Status
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Pages
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Uploaded
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, index) => (
                <tr key={doc.id} style={{ borderTop: index > 0 ? '1px solid #e5e7eb' : 'none' }}>
                  <td style={{ padding: '12px' }}>
                    <div>
                      <p style={{ fontWeight: '500', color: '#1f2937' }}>{doc.filename}</p>
                      {doc.chunks && (
                        <p style={{ fontSize: '12px', color: '#6b7280' }}>
                          {doc.chunks} text chunks
                        </p>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: `${getStatusColor(doc.status)}20`,
                      color: getStatusColor(doc.status)
                    }}>
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>
                    {doc.pages || 'N/A'}
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280', fontSize: '14px' }}>
                    {formatDate(doc.uploaded_at)}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      disabled={deleting === doc.id}
                      className="btn btn-danger"
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        opacity: deleting === doc.id ? 0.6 : 1
                      }}
                    >
                      {deleting === doc.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DocumentList;