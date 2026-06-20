import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: attach token ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nexus_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle token refresh ───────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('nexus_refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
        const newToken = data.data.accessToken;
        localStorage.setItem('nexus_access_token', newToken);
        localStorage.setItem('nexus_refresh_token', data.data.refreshToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('nexus_access_token');
        localStorage.removeItem('nexus_refresh_token');
        localStorage.removeItem('nexus_user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { name: string; email: string; password: string; role: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string; role: string }) =>
    api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh-token', { refreshToken }),

  getMe: () => api.get('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
};

// ─── Users API ────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: (id: string) => api.get(`/users/profile/${id}`),

  updateProfile: (updates: Record<string, any>) =>
    api.put('/users/profile', updates),

  uploadAvatar: (formData: FormData) =>
    api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getEntrepreneurs: (params?: Record<string, any>) =>
    api.get('/users/entrepreneurs', { params }),

  getInvestors: (params?: Record<string, any>) =>
    api.get('/users/investors', { params }),
};

// ─── Meetings API ─────────────────────────────────────────────────────────────
export const meetingsAPI = {
  schedule: (data: {
    attendeeId: string;
    title: string;
    description?: string;
    scheduledAt: string;
    duration: number;
    meetingType?: string;
    agenda?: string;
  }) => api.post('/meetings', data),

  getAll: (params?: { status?: string; upcoming?: string; page?: number; limit?: number }) =>
    api.get('/meetings', { params }),

  getById: (id: string) => api.get(`/meetings/${id}`),

  update: (id: string, data: Record<string, any>) => api.put(`/meetings/${id}`, data),

  respond: (id: string, status: 'accepted' | 'rejected', rejectionReason?: string) =>
    api.patch(`/meetings/${id}/respond`, { status, rejectionReason }),

  cancel: (id: string) => api.patch(`/meetings/${id}/cancel`),
};

// ─── Collaborations API ───────────────────────────────────────────────────────
export const collaborationsAPI = {
  send: (data: { entrepreneurId: string; message: string; investmentAmount?: string }) =>
    api.post('/collaborations', data),

  getAll: (params?: { status?: string; page?: number }) =>
    api.get('/collaborations', { params }),

  respond: (id: string, status: 'accepted' | 'rejected', responseMessage?: string) =>
    api.patch(`/collaborations/${id}/respond`, { status, responseMessage }),

  withdraw: (id: string) => api.delete(`/collaborations/${id}`),
};

// ─── Messages API ─────────────────────────────────────────────────────────────
export const messagesAPI = {
  getConversations: () => api.get('/messages/conversations'),

  getMessages: (userId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/messages/${userId}`, { params }),

  send: (userId: string, content: string) =>
    api.post(`/messages/${userId}`, { content }),

  delete: (messageId: string) => api.delete(`/messages/${messageId}`),
};

// ─── Documents API ────────────────────────────────────────────────────────────
export const documentsAPI = {
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getAll: (params?: { category?: string; search?: string; page?: number }) =>
    api.get('/documents', { params }),

  getById: (id: string) => api.get(`/documents/${id}`),

  share: (id: string, userId: string, permission?: string) =>
    api.post(`/documents/${id}/share`, { userId, permission }),

  download: (id: string) => api.patch(`/documents/${id}/download`),

  delete: (id: string) => api.delete(`/documents/${id}`),
};

// ─── Notifications API ────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params?: { isRead?: boolean; page?: number }) =>
    api.get('/notifications', { params }),

  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllAsRead: () => api.patch('/notifications/read-all'),

  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export default api;
