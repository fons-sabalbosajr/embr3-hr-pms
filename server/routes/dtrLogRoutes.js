import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { getMergedDTRLogs, markAllDTRLogsAsRead, markDTRLogAsRead, updateDTRLog, deleteDTRLog } from "../controllers/dtrLogController.js";
import { getGroupedEmployeeDTR } from "../controllers/dtrLogGroupedController.js";
import { getWorkCalendar } from "../controllers/dtrWorkCalendarController.js";

const router = express.Router();
router.get("/merged", getMergedDTRLogs);
router.get("/grouped", getGroupedEmployeeDTR);
router.get("/work-calendar", getWorkCalendar);
router.put("/:id/read", verifyToken, markDTRLogAsRead);
router.put("/read-all", verifyToken, markAllDTRLogsAsRead);
router.put("/:id", verifyToken, updateDTRLog);
router.delete("/:id", verifyToken, deleteDTRLog);
export default router;
