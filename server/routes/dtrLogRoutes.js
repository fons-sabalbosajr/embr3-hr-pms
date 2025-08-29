import express from "express";
import { getMergedDTRLogs } from "../controllers/dtrLogController.js";
import { getGroupedEmployeeDTR } from "../controllers/dtrLogGroupedController.js";

const router = express.Router();
router.get("/merged", getMergedDTRLogs);
router.get("/grouped", getGroupedEmployeeDTR);
export default router;
