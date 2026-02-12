import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { reportBug, listBugReports, updateBugReport, deleteBugReport } from "../controllers/bugReportController.js";
import { requireAnyPermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();

// Public endpoint to submit bug reports
router.post("/", reportBug);

// Authenticated management endpoints
const requireDev = requireAnyPermission(["canAccessDeveloper", "canSeeDev"]);

router.get("/", verifyToken, requireDev, listBugReports);
router.patch("/:id", verifyToken, requireDev, updateBugReport);
router.delete("/:id", verifyToken, requireDev, deleteBugReport);

export default router;
