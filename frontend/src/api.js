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
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { 
    token, 
    new_password: newPassword 
  }),
  verifyResetToken: (token) => api.post('/auth/verify-reset-token', { token }),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  changePassword: (currentPassword, newPassword) => api.put('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword
  }),
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
  getChatOptions: () => api.get('/api/chat-options'),
  createChatOption: (optionData) => api.post('/api/admin/chat-options', optionData),
  deleteChatOption: (optionId) => api.delete(`/api/admin/chat-options/${optionId}`),
  getDirectChats: () => api.get('/admin/direct-chats'),
  getChatMessages: (chatId) => api.get(`/admin/direct-chats/${chatId}/messages`),
  sendAdminMessage: (chatId, message) => api.post(`/admin/direct-chats/${chatId}/messages`, { message }),
};

export default api;