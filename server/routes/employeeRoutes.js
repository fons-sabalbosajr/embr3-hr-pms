import express from "express";

import {
  uploadEmployees,
  getEmployees,
  updateEmployeeById,
  addEmployee,
  getLatestEmpNo,
  checkEmpIdUnique
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/upload-employees", uploadEmployees);
router.post("/", addEmployee);
router.get("/", getEmployees);
router.put("/:id", updateEmployeeById);
router.get("/latest-empno/:type", getLatestEmpNo);
router.get("/employees/check-empId", checkEmpIdUnique);

export default router;
