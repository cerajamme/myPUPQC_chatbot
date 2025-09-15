import React, { useState, useRef } from 'react';
import { admin } from '../api';
import './FileUploadStyles.css';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (selectedFile) => {
    if (selectedFile && selectedFile.type === 'application/pdf') {
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
        setMessage('File size must be less than 50MB.');
        setMessageType('error');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setMessage('');
    } else {
      setMessage('Please select a PDF file only.');
      setMessageType('error');
      setFile(null);
    }
  };

  const handleInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileChange(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!uploading) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!uploading) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileChange(droppedFile);
      }
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
      await admin.uploadDocument(file);
      setMessage(`Successfully uploaded: ${file.name}`);
      setMessageType('success');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Upload failed. Please try again.');
      setMessageType('error');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2);
  };

  return (
    <div className="file-upload-container">
      {/* Header */}
      <div className="file-upload-header">
        <h2 className="file-upload-title">Upload PDF Documents</h2>
        <p className="file-upload-subtitle">
          Upload your PDF documents to add them to the chatbot's knowledge base
        </p>
      </div>

      {/* Form */}
      <div className="file-upload-form">
        {/* Drop Zone */}
        <div 
          className={`file-upload-dropzone ${dragOver ? 'dragover' : ''} ${uploading ? 'disabled' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleInputChange}
            className="file-upload-input"
            disabled={uploading}
          />
          
          <svg className="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          
          <p className="upload-main-text">
            {dragOver ? 'Drop your PDF file here' : 'Click to upload or drag and drop'}
          </p>
          <p className="upload-sub-text">
            Select a PDF file from your computer
          </p>
          <p className="upload-format-text">
            PDF files only • Maximum size: 50MB
          </p>
        </div>

        {/* Selected File Display */}
        {file && (
          <div className="selected-file-card">
            <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <div className="file-details">
              <p className="file-name">{file.name}</p>
              <p className="file-size">{formatFileSize(file.size)} MB</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              className="remove-file-btn"
              disabled={uploading}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Message Display */}
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

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="upload-button"
        >
          {uploading && <div className="upload-spinner"></div>}
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;