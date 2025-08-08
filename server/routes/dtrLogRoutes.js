import express from "express";
import { getMergedDTRLogs } from "../controllers/dtrLogController.js";

const router = express.Router();
router.get("/merged", getMergedDTRLogs);
export default router;
