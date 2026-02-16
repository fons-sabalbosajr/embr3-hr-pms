import axiosInstance from './axiosInstance';
import { secureSessionStore } from '../../utils/secureStorage';

export const login = async (credentials) => {
  const res = await axiosInstance.post('/users/login', credentials);
  secureSessionStore('token', res.data.token);
  return res.data;
};

export const getAllUsers = async () => {
  return await axiosInstance.get('/users');
};

