import React, { useState } from 'react';
import { admin } from '../api';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setMessage('');
    } else {
      setMessage('Please select a PDF file only.');
      setMessageType('error');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first.');
      setMessageType('error');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const response = await admin.uploadDocument(file);
      setMessage(`Successfully uploaded: ${file.name}`);
      setMessageType('success');
      setFile(null);
      // Reset file input
      document.getElementById('fileInput').value = '';
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Upload failed. Please try again.');
      setMessageType('error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
        Upload PDF Documents
      </h2>
      
      <div className="form-group">
        <label className="form-label">Select PDF File</label>
        <input
          id="fileInput"
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="form-input"
          disabled={uploading}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
          Only PDF files are supported. Maximum file size: 50MB.
        </p>
      </div>

      {file && (
        <div style={{ padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#0369a1' }}>
            Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        </div>
      )}

      {message && (
        <div style={{
          padding: '12px',
          backgroundColor: messageType === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${messageType === 'success' ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          <p style={{
            fontSize: '14px',
            color: messageType === 'success' ? '#166534' : '#dc2626'
          }}>
            {message}
          </p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="btn btn-primary"
        style={{
          opacity: (!file || uploading) ? 0.6 : 1,
          cursor: (!file || uploading) ? 'not-allowed' : 'pointer'
        }}
      >
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </div>
  );
};

export default FileUpload;