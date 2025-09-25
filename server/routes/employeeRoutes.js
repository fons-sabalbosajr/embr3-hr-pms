import express from "express";

import {
  uploadEmployees,
  getEmployees,
  updateEmployeeById,
  addEmployee,
  getLatestEmpNo,
  checkEmpIdUnique,
  getSignatoryEmployees,
  getUniqueSectionOrUnits
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/upload-employees", uploadEmployees);
router.post("/", addEmployee);
router.get("/", getEmployees);
router.get("/signatories", getSignatoryEmployees);
router.get("/unique-sections", getUniqueSectionOrUnits);
router.put("/:id", updateEmployeeById);
router.get("/latest-empno/:type", getLatestEmpNo);
router.get("/employees/check-empId", checkEmpIdUnique);

export default router;