import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { reportBug, listBugReports, updateBugReport, deleteBugReport } from "../controllers/bugReportController.js";

const router = express.Router();

// Public endpoint to submit bug reports
router.post("/", reportBug);

// Authenticated management endpoints
router.get("/", verifyToken, listBugReports);
router.patch("/:id", verifyToken, updateBugReport);
router.delete("/:id", verifyToken, deleteBugReport);

export default router;
