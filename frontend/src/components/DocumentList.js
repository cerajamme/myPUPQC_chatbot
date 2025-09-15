import React, { useState, useEffect } from 'react';
import { admin } from '../api';
import './DocumentListStyles.css';

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
      setError('');
      const response = await admin.getDocuments();
      setDocuments(response.data);
    } catch (error) {
      setError('Failed to fetch documents. Please try again.');
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
      setError('');
    } catch (error) {
      setError('Failed to delete document. Please try again.');
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

  if (loading) {
    return (
      <div className="document-list-wrapper">
        <div className="document-list-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading documents...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-list-wrapper">
      <div className="document-list-container">
        {/* Action Header - Just Refresh Button */}
        <div className="action-header">
          <button onClick={fetchDocuments} className="refresh-button">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.357 2m-15.357-2H9" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Content */}
        <div className="content-section">
          {/* Error Message */}
          {error && (
            <div className="error-message">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="error-text">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {documents.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 18l-3-3m0 0l-3 3m3-3v-15" />
              </svg>
              <h3 className="empty-title">No documents uploaded yet</h3>
              <p className="empty-description">
                Upload PDF documents to get started with your chatbot knowledge base.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <table className="documents-table">
                <thead className="table-header">
                  <tr>
                    <th>Document</th>
                    <th>Status</th>
                    <th>Pages</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="table-row ">
                      <td className="table-cell">
                        <div className="document-info">
                        <div className="document-details aligned-left">
                          <p className="document-name">{doc.filename}</p>
                          {doc.chunks && (
                            <p className="document-meta">{doc.chunks} chunks</p>
                          )}
                        </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`status-badge ${doc.status || 'default'}`}>
                          <span className={`status-dot ${doc.status || 'default'}`}></span>
                          {(doc.status || 'unknown').charAt(0).toUpperCase() + (doc.status || 'unknown').slice(1)}
                        </span>
                      </td>
                      <td className="table-cell">{doc.pages || 'N/A'}</td>
                      <td className="table-cell">{formatDate(doc.uploaded_at)}</td>
                      <td className="table-cell">
                        <button
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          disabled={deleting === doc.id}
                          className="delete-button"
                        >
                          {deleting === doc.id ? (
                            <>
                              <div className="delete-spinner"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="mobile-cards">
                {documents.map((doc) => (
                  <div key={doc.id} className="document-card">
                    <div className="card-header">
                      <div className="document-info">
                        <svg className="document-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621 0 1.125.504 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <div className="document-details">
                          <p className="document-name">{doc.filename}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        disabled={deleting === doc.id}
                        className="delete-button"
                      >
                        {deleting === doc.id ? (
                          <div className="delete-spinner"></div>
                        ) : (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    <div className="card-content">
                      <div className="card-row">
                        <span className="card-label">Status</span>
                        <span className={`status-badge ${doc.status || 'default'}`}>
                          <span className={`status-dot ${doc.status || 'default'}`}></span>
                          {(doc.status || 'unknown').charAt(0).toUpperCase() + (doc.status || 'unknown').slice(1)}
                        </span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Pages</span>
                        <span className="card-value">{doc.pages || 'N/A'}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Uploaded</span>
                        <span className="card-value">{formatDate(doc.uploaded_at)}</span>
                      </div>
                      {doc.chunks && (
                        <div className="card-row">
                          <span className="card-label">Chunks</span>
                          <span className="card-value">{doc.chunks}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentList;