import express from "express";
import { createPayslipRequest, getPayslipRequests, markAllPayslipRequestsAsRead, markNotificationAsRead } from "../controllers/payslipRequestController.js";

const router = express.Router();

router.post("/", createPayslipRequest);
router.get("/", getPayslipRequests); // <-- added
router.put("/:id/read", markNotificationAsRead);
router.put("/read-all", markAllPayslipRequestsAsRead);

export default router;
