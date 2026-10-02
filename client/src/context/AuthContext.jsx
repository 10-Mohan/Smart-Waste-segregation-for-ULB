import { createContext, useContext, useEffect, useState } from 'react';
import api, { SESSION_TOKEN_KEY } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return () => { active = false; };
    }

    api.get('/auth/me')
      .then(({ data }) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });

    const clearSession = () => {
      if (active) setUser(null);
    };
    window.addEventListener('waste-session-expired', clearSession);
    return () => {
      active = false;
      window.removeEventListener('waste-session-expired', clearSession);
    };
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}