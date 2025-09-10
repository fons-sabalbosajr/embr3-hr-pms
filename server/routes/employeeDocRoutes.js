import express from "express";
import  { createEmployeeDoc, getEmployeeDocs }  from "../controllers/employeeDocController.js";

const router = express.Router();

// GET /api/employee-docs/by-employee/:empId
router.get("/by-employee/:empId", getEmployeeDocs);

// POST /api/employee-docs
router.post("/", createEmployeeDoc);

export default router;
