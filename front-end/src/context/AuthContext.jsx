import React, { createContext, useState, useEffect } from 'react';
import { secureGet, secureStore, secureRemove } from '../../utils/secureStorage';
import axiosInstance from '../api/axiosInstance';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(secureGet('token'));

  useEffect(() => {
    const storedUser = secureGet('user');
    if (storedUser) {
      setUser(storedUser);
    }
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (credentials) => {
    const res = await axiosInstance.post('/users/login', credentials);
    const { token, user } = res.data;
    secureStore('token', token);
    secureStore('user', user);
    setToken(token);
    setUser(user);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return user;
  };

  const logout = () => {
    secureRemove('token');
    secureRemove('user');
    setToken(null);
    setUser(null);
    delete axiosInstance.defaults.headers.common['Authorization'];
  };

  const updateCurrentUser = (updatedUser) => {
    setUser(updatedUser);
    secureStore('user', updatedUser);
  };

  const hasPermission = (permissions) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (!permissions || permissions.length === 0) return true; // No specific permission required

    return permissions.every(p => user[p]);
  };

  const value = {
    user,
    token,
    login,
    logout,
    updateCurrentUser,
    isAuthenticated: !!token,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
