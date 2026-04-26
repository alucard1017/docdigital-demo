// mobile/src/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getCurrentUser, logout as apiLogout } from '../api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('auth_token');
      
      if (!token) {
        setUser(null);
        return;
      }

      const userData = await getCurrentUser();
      setUser(userData.user || userData);
    } catch (err) {
      console.error('Error cargando usuario:', err);
      setError(err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
      setUser(null);
    } catch (err) {
      console.error('Error en logout:', err);
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    reload: loadUser,
    logout,
  };
}