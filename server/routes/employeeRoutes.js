import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

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
  purgeResignedEmployeesCascade,
  searchEmployeesByEmpId,
} from "../controllers/employeeController.js";

const router = express.Router();

// ── Public read-only routes (no auth) ──
// Used by the public Employee Request Portal pages
router.get("/public/search", searchEmployeesByEmpId);
router.get("/public/by-emp-id/:empId", getEmployeeByEmpId);

router.post(
  "/upload-employees",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  uploadEmployees
);
router.post("/", verifyToken, requirePermissions(["canEditEmployees"]), addEmployee);
router.get(
  "/",
  verifyToken,
  requirePermissions(["canViewEmployees"]),
  getEmployees
);
router.get(
  "/signatories",
  verifyToken,
  requireAnyPermission(["canViewEmployees", "canViewDTR", "canViewPayroll"]),
  getSignatoryEmployees
);
router.get(
  "/unique-sections",
  verifyToken,
  requirePermissions(["canViewEmployees"]),
  getUniqueSectionOrUnits
);
router.put(
  "/:id",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  updateEmployeeById
);
router.get(
  "/latest-empno/:type",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  getLatestEmpNo
);
router.get(
  "/employees/check-empId",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  checkEmpIdUnique
);
router.get(
  "/by-emp-id/:empId",
  verifyToken,
  requirePermissions(["canViewEmployees"]),
  getEmployeeByEmpId
);
router.get(
  "/search-emp-id",
  verifyToken,
  requireAnyPermission(["canViewEmployees", "canViewDTR", "canViewPayroll"]),
  searchEmployeesByEmpId
);
router.put(
  "/:id/resign",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  resignEmployee
);
router.put(
  "/:id/undo-resign",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  undoResignEmployee
);
router.get(
  "/:id/records",
  verifyToken,
  requirePermissions(["canViewEmployees"]),
  getEmployeeRecords
);
router.delete(
  "/resigned/purge",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  purgeResignedEmployeesCascade
);
router.delete(
  "/:id",
  verifyToken,
  requirePermissions(["canEditEmployees"]),
  deleteEmployeeCascade
);

export default router;