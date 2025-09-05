import express from "express";
import { getMergedDTRLogs } from "../controllers/dtrLogController.js";
import { getGroupedEmployeeDTR } from "../controllers/dtrLogGroupedController.js";
import { getWorkCalendar } from "../controllers/dtrWorkCalendarController.js";

const router = express.Router();
router.get("/merged", getMergedDTRLogs);
router.get("/grouped", getGroupedEmployeeDTR);
router.get("/work-calendar", getWorkCalendar);
export default router;
