import axiosInstance from './axiosInstance';

export const getAllTrainings = async () => {
  return await axiosInstance.get('/trainings');
};

