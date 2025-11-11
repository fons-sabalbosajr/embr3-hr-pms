import express from "express";
import multer from "multer";
import verifyToken from "../middleware/authMiddleware.js";
import  { createEmployeeDoc, getEmployeeDocs, getNextPayslipNumber, getAllEmployeeDocs }  from "../controllers/employeeDocController.js";

const router = express.Router();

// Auth middleware
router.use(verifyToken);

// Multer memory storage (align with generic upload route limits)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/employee-docs/by-employee/:empId
router.get("/by-employee/:empId", getEmployeeDocs);

// POST /api/employee-docs (optional file field: file)
router.post("/", upload.single('file'), createEmployeeDoc);

// GET /api/employee-docs/next-payslip-number/:empId
router.get("/next-payslip-number/:empId", getNextPayslipNumber);

router.get("/", getAllEmployeeDocs);

export default router;
