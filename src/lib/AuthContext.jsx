import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { apiGet, apiPost, setBackendToken, getBackendToken } from '@/api/backendClient';

// JWT auth against the self-hosted backend (replaces the old Base44 auth).
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // On load: if a token is stored, fetch the current user; otherwise show login.
  useEffect(() => {
    (async () => {
      if (!getBackendToken()) {
        setIsLoadingAuth(false);
        return;
      }
      try {
        const { user: me } = await apiGet('/api/auth/me');
        setUser(me);
        setIsAuthenticated(true);
      } catch {
        setBackendToken(null); // expired/invalid token → back to login
      } finally {
        setIsLoadingAuth(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await apiPost('/api/auth/login', { email, password });
    setBackendToken(result.token);
    setUser(result.user);
    setIsAuthenticated(true);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    setBackendToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
