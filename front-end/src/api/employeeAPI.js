import axiosInstance from './axiosInstance';

export const uploadEmployees = async (employeeData) => {
  return await axiosInstance.post('/employees/upload-employees', {
    employees: employeeData,
  });
};

export const getEmployees = async () => {
  return await axiosInstance.get('/employees');
};

export const getEmployeesAll = async ({ includeResigned = true, page, pageSize } = {}) => {
  const params = {};
  if (includeResigned) params.includeResigned = 'true';
  if (page !== undefined) params.page = String(page);
  if (pageSize !== undefined) params.pageSize = String(pageSize);
  return await axiosInstance.get('/employees', { params });
};

export const resignEmployee = async (id, { reason, resignedAt } = {}) => {
  return await axiosInstance.put(`/employees/${id}/resign`, { reason, resignedAt });
};

export const undoResignEmployee = async (id) => {
  return await axiosInstance.put(`/employees/${id}/undo-resign`);
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

export const updateEmployeeDoc = async (id, payload) => {
  return await axiosInstance.patch(`/employee-docs/${id}`, payload);
};

export const deleteEmployeeDoc = async (id) => {
  return await axiosInstance.delete(`/employee-docs/${id}`);
};
