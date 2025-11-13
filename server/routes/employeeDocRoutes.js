import express from "express";
import multer from "multer";
import verifyToken from "../middleware/authMiddleware.js";
import  { createEmployeeDoc, getEmployeeDocs, getNextPayslipNumber, getAllEmployeeDocs, updateEmployeeDoc, deleteEmployeeDoc }  from "../controllers/employeeDocController.js";

const router = express.Router();

// Auth middleware
router.use(verifyToken);

// Dev-only guard middleware
const requireDeveloper = async (req, res, next) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ message: 'Unauthorized' });
		const { default: User } = await import('../models/User.js');
		const u = await User.findById(userId).select('userType isAdmin canAccessDeveloper canSeeDev').lean();
		const allowed = Boolean(u && (u.userType === 'developer' || u.canAccessDeveloper || u.canSeeDev));
		if (!allowed) return res.status(403).json({ message: 'Developer access required' });
		return next();
	} catch (e) {
		return res.status(403).json({ message: 'Developer access required' });
	}
};

// Multer memory storage (align with generic upload route limits)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/employee-docs/by-employee/:empId
router.get("/by-employee/:empId", getEmployeeDocs);

// POST /api/employee-docs (optional file field: file)
router.post("/", upload.single('file'), createEmployeeDoc);

// GET /api/employee-docs/next-payslip-number/:empId
router.get("/next-payslip-number/:empId", getNextPayslipNumber);

router.get("/", getAllEmployeeDocs);

// Dev-only mutations
router.patch('/:id', requireDeveloper, updateEmployeeDoc);
router.delete('/:id', requireDeveloper, deleteEmployeeDoc);

export default router;
