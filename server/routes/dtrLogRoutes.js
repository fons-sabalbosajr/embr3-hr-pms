import express from "express";
import { getMergedDTRLogs, markAllDTRLogsAsRead, markDTRLogAsRead } from "../controllers/dtrLogController.js";
import { getGroupedEmployeeDTR } from "../controllers/dtrLogGroupedController.js";
import { getWorkCalendar } from "../controllers/dtrWorkCalendarController.js";

const router = express.Router();
router.get("/merged", getMergedDTRLogs);
router.get("/grouped", getGroupedEmployeeDTR);
router.get("/work-calendar", getWorkCalendar);
router.put("/:id/read", markDTRLogAsRead);
router.put("/read-all", markAllDTRLogsAsRead);
export default router;
