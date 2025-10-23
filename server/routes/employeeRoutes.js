import express from "express";
import verifyToken from "../middleware/authMiddleware.js";

import {
  uploadEmployees,
  getEmployees,
  updateEmployeeById,
  addEmployee,
  getLatestEmpNo,
  checkEmpIdUnique,
  getSignatoryEmployees,
  getUniqueSectionOrUnits,
  getEmployeeByEmpId,
  resignEmployee,
  undoResignEmployee,
  getEmployeeRecords,
  deleteEmployeeCascade,
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/upload-employees", uploadEmployees);
router.post("/", addEmployee);
router.get("/", verifyToken, getEmployees);
router.get("/signatories", getSignatoryEmployees);
router.get("/unique-sections", getUniqueSectionOrUnits);
router.put("/:id", updateEmployeeById);
router.get("/latest-empno/:type", getLatestEmpNo);
router.get("/employees/check-empId", checkEmpIdUnique);
router.get("/by-emp-id/:empId", verifyToken, getEmployeeByEmpId);
// Developer-only actions
router.put("/:id/resign", verifyToken, resignEmployee);
router.put("/:id/undo-resign", verifyToken, undoResignEmployee);
router.get("/:id/records", verifyToken, getEmployeeRecords);
router.delete("/:id", verifyToken, deleteEmployeeCascade);

export default router;