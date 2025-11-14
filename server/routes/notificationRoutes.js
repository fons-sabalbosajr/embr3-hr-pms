import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { sendNoTimeRecordReminder, sendNoTimeRecordBulk } from "../controllers/notificationController.js";

const router = express.Router();

// HR-only (protected) endpoint to send reminders
router.post("/no-time-record", verifyToken, sendNoTimeRecordReminder);
router.post("/no-time-record/bulk", verifyToken, sendNoTimeRecordBulk);

export default router;
