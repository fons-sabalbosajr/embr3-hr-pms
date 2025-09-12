import express from "express";
import {
  getAllEmployeeSalaries,
  getEmployeeSalaryByEmployeeId,
  createEmployeeSalary,
  updateEmployeeSalary,
  deleteEmployeeSalary,
} from "../controllers/employeeSalaryController.js";
import { verifyToken } from "../middleware/authMiddleware.js"; // Assuming you have auth middleware

const router = express.Router();

// Apply protect middleware to all routes if authentication is required
// router.use(protect);

router.route("/").get(getAllEmployeeSalaries).post(createEmployeeSalary);
router
  .route("/:id") // This ID refers to the _id of the EmployeeSalary document
  .put(updateEmployeeSalary)
  .delete(deleteEmployeeSalary);

router.route("/employee/:employeeId").get(getEmployeeSalaryByEmployeeId); // To get by employee's _id

export default router;
