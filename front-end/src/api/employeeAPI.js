import axios from 'axios';

export const uploadEmployees = async (employeeData) => {
  return await axios.post('/api/employees/upload-employees', {
    employees: employeeData,
  });
};
