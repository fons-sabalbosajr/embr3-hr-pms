import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import { createPayslipRequest, getPayslipRequests, markAllPayslipRequestsAsRead, markNotificationAsRead, deletePayslipRequest, updatePayslipRequest, sendPayslipEmail } from "../controllers/payslipRequestController.js";

const router = express.Router();

router.post("/", createPayslipRequest);
router.get("/", verifyToken, requirePermissions(["canViewPayroll"]), getPayslipRequests); // <-- added
router.put(
	"/:id/read",
	verifyToken,
	requirePermissions(["canViewPayroll"]),
	markNotificationAsRead
);
router.put(
	"/:id",
	verifyToken,
	requirePermissions(["canProcessPayroll"]),
	updatePayslipRequest
);
router.put(
	"/read-all",
	verifyToken,
	requirePermissions(["canViewPayroll"]),
	markAllPayslipRequestsAsRead
);
router.delete(
	"/:id",
	verifyToken,
	requirePermissions(["canProcessPayroll"]),
	deletePayslipRequest
);
router.post(
	"/:id/send-email",
	verifyToken,
	requirePermissions(["canProcessPayroll"]),
	sendPayslipEmail
);

export default router;
