import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import { getMergedDTRLogs, markAllDTRLogsAsRead, markDTRLogAsRead, updateDTRLog, deleteDTRLog, createDTRLogEntry } from "../controllers/dtrLogController.js";
import { getGroupedEmployeeDTR } from "../controllers/dtrLogGroupedController.js";
import { getWorkCalendar } from "../controllers/dtrWorkCalendarController.js";

const router = express.Router();

// ── Public read-only route (no auth) ──
// Used by the public DTR Request Portal page
router.get("/public/merged", getMergedDTRLogs);

router.use(verifyToken);

router.get("/merged", requirePermissions(["canViewDTR"]), getMergedDTRLogs);
router.get("/grouped", requirePermissions(["canViewDTR"]), getGroupedEmployeeDTR);
router.get("/work-calendar", requirePermissions(["canViewDTR"]), getWorkCalendar);
router.put("/:id/read", requirePermissions(["canViewDTR"]), markDTRLogAsRead);
router.put("/read-all", requirePermissions(["canViewDTR"]), markAllDTRLogsAsRead);
router.put("/:id", requirePermissions(["canProcessDTR"]), updateDTRLog);
router.post("/", requirePermissions(["canProcessDTR"]), createDTRLogEntry);
router.delete("/:id", requirePermissions(["canProcessDTR"]), deleteDTRLog);
export default router;
