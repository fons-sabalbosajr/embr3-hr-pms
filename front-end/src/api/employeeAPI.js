import axiosInstance from './axiosInstance';

export const uploadEmployees = async (employeeData) => {
  return await axiosInstance.post('/employees/upload-employees', {
    employees: employeeData,
  });
};

export const getEmployees = async () => {
  return await axiosInstance.get('/employees');
};

export const getSignatoryEmployees = async () => {
  return await axiosInstance.get('/employees/signatories');
};

export const updateEmployeeSignatory = async (id, signatoryData) => {
  return await axiosInstance.put(`/employees/${id}`, signatoryData);
};

export const getUniqueSectionOrUnits = async () => {
  return await axiosInstance.get('/employees/unique-sections');
};

export const getEmployeeDocs = async () => {
  return await axiosInstance.get('/employee-docs');
};
