import express from "express";
import { createDTRLog, getDTRLogs } from "../controllers/dtrGenerationLogController.js";

const router = express.Router();

router.post("/", createDTRLog);
router.get("/", getDTRLogs); // <-- added

export default router;
