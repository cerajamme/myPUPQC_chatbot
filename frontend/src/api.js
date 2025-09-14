import axios from 'axios';

// In src/api.js, update the API_BASE_URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://mypupqcchatbot-production.up.railway.app'  // Your live backend
  : 'http://localhost:8000';
  
// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API functions
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me'),
};

export const admin = {
  getStudentInfo: () => api.get('/admin/student/info'),
  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/student/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getDocuments: () => api.get('/admin/student/documents'),
  deleteDocument: (id) => api.delete(`/admin/student/documents/${id}`),
  testChat: (message, sessionId) => api.post('/admin/student/test-chat', { message, session_id: sessionId }),
  getAnalytics: () => api.get('/admin/student/analytics'),
};

export default api;
