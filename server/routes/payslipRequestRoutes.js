import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { createPayslipRequest, getPayslipRequests, markAllPayslipRequestsAsRead, markNotificationAsRead, deletePayslipRequest, updatePayslipRequest } from "../controllers/payslipRequestController.js";

const router = express.Router();

router.post("/", createPayslipRequest);
router.get("/", getPayslipRequests); // <-- added
router.put("/:id/read", verifyToken, markNotificationAsRead);
router.put("/:id", verifyToken, updatePayslipRequest);
router.put("/read-all", verifyToken, markAllPayslipRequestsAsRead);
router.delete("/:id", verifyToken, deletePayslipRequest);

export default router;
