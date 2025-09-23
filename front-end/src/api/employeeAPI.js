import axiosInstance from './axiosInstance';

export const uploadEmployees = async (employeeData) => {
  return await axiosInstance.post('/employees/upload-employees', {
    employees: employeeData,
  });
};

export const getEmployees = async () => {
  return await axiosInstance.get('/employees');
};

