import express from "express";
import multer from "multer";
import verifyToken from "../middleware/authMiddleware.js";
import  { createEmployeeDoc, getEmployeeDocs, getNextPayslipNumber, getAllEmployeeDocs, updateEmployeeDoc, deleteEmployeeDoc }  from "../controllers/employeeDocController.js";
import { requireAnyPermission, requirePermissions } from "../middleware/permissionMiddleware.js";

const router = express.Router();

// Auth middleware
router.use(verifyToken);

// Multer memory storage (align with generic upload route limits)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/employee-docs/by-employee/:empId
router.get(
	"/by-employee/:empId",
	requireAnyPermission(["canViewEmployees", "canViewPayroll"]),
	getEmployeeDocs
);

// POST /api/employee-docs (optional file field: file)
router.post(
	"/",
	requireAnyPermission(["canEditEmployees", "canProcessPayroll"]),
	upload.single('file'),
	createEmployeeDoc
);

// GET /api/employee-docs/next-payslip-number/:empId
router.get(
	"/next-payslip-number/:empId",
	requireAnyPermission(["canViewPayroll", "canProcessPayroll"]),
	getNextPayslipNumber
);

router.get(
	"/",
	requireAnyPermission(["canViewEmployees", "canViewPayroll"]),
	getAllEmployeeDocs
);

// Dev-only mutations
router.patch(
	'/:id',
	requireAnyPermission(["canAccessDeveloper", "canSeeDev"]),
	updateEmployeeDoc
);
router.delete(
	'/:id',
	requireAnyPermission(["canAccessDeveloper", "canSeeDev"]),
	deleteEmployeeDoc
);

export default router;
