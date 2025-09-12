import EmployeeSalary from "../models/EmployeeSalary.js";
import Employee from "../models/Employee.js"; // To check if employee exists

// Get all employee salary records, optionally populate employee details
export const getAllEmployeeSalaries = async (req, res) => {
  try {
    const employeeSalaries = await EmployeeSalary.find().populate("employeeId");
    res.status(200).json(employeeSalaries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single employee salary record by employeeId
export const getEmployeeSalaryByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employeeSalary = await EmployeeSalary.findOne({ employeeId }).populate("employeeId");
    if (!employeeSalary) {
      return res.status(404).json({ message: "Employee salary record not found" });
    }
    res.status(200).json(employeeSalary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new employee salary record
export const createEmployeeSalary = async (req, res) => {
  const { employeeId } = req.body;

  // Check if employee exists
  const employeeExists = await Employee.findById(employeeId);
  if (!employeeExists) {
    return res.status(404).json({ message: "Employee not found" });
  }

  // Check if salary record already exists for this employee
  const existingSalary = await EmployeeSalary.findOne({ employeeId });
  if (existingSalary) {
    return res.status(409).json({ message: "Salary record already exists for this employee" });
  }

  const newEmployeeSalary = new EmployeeSalary(req.body);
  try {
    const savedEmployeeSalary = await newEmployeeSalary.save();
    res.status(201).json(savedEmployeeSalary);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update an existing employee salary record
export const updateEmployeeSalary = async (req, res) => {
  const { id } = req.params; // This 'id' will be the _id of the EmployeeSalary document
  try {
    const updatedEmployeeSalary = await EmployeeSalary.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate("employeeId");
    if (!updatedEmployeeSalary) {
      return res.status(404).json({ message: "Employee salary record not found" });
    }
    res.status(200).json(updatedEmployeeSalary);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an employee salary record
export const deleteEmployeeSalary = async (req, res) => {
  const { id } = req.params; // This 'id' will be the _id of the EmployeeSalary document
  try {
    const deletedEmployeeSalary = await EmployeeSalary.findByIdAndDelete(id);
    if (!deletedEmployeeSalary) {
      return res.status(404).json({ message: "Employee salary record not found" });
    }
    res.status(200).json({ message: "Employee salary record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
