import axios from 'axios';

export const SESSION_TOKEN_KEY = 'waste-segregation-session-token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.citizen || ['/auth/login', '/auth/otp/'].some((path) => error.config?.url?.includes(path));
    if (!error.response) window.dispatchEvent(new Event('waste-api-network-error'));
    if (error.response?.status === 401 && !isLoginRequest) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('waste-session-expired'));
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export default api;