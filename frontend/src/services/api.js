import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  verify: (token) => api.post('/auth/verify', { token }),
};

// Device API
export const deviceAPI = {
  getCurrent: () => api.get('/device/current'),
  getStatus: () => api.get('/device/status'),
  getConfig: () => api.get('/device/config'),
  getHistory: (period) => api.get(`/device/history/${period}`),
  getAccumulated: () => api.get('/device/accumulated'),
  resetAccumulated: () => api.post('/device/accumulated/reset'),
  getRelayNames: () => api.get('/device/relay-names'),
  getDisplayStatus: () => api.get('/device/display'),
  setDisplayEnabled: (enabled) => api.put('/device/display', { enabled }),
  getReport: (startDate, endDate) => api.get(`/device/report?startDate=${startDate}&endDate=${endDate}`),
};

// Relay API
export const relayAPI = {
  control: (relay, state) => api.post('/relay/control', { relay, state }),
  getStates: () => api.get('/relay/states'),
};

// Automation API
export const automationAPI = {
  getRules: () => api.get('/automation/rules'),
  saveRule: (rule) => api.post('/automation/rules', rule),
  deleteRule: (id) => api.delete(`/automation/rules/${id}`),
  getStatus: () => api.get('/automation/status'),
};

export default api;
