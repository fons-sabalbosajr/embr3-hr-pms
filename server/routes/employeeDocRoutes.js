import express from "express";
import  { createEmployeeDoc, getEmployeeDocs, getNextPayslipNumber, getAllEmployeeDocs }  from "../controllers/employeeDocController.js";

const router = express.Router();

// GET /api/employee-docs/by-employee/:empId
router.get("/by-employee/:empId", getEmployeeDocs);

// POST /api/employee-docs
router.post("/", createEmployeeDoc);

// GET /api/employee-docs/next-payslip-number/:empId
router.get("/next-payslip-number/:empId", getNextPayslipNumber);

router.get("/", getAllEmployeeDocs);

export default router;
