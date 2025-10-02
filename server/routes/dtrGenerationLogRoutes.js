// routes/dtrGenerationLogRoutes.js
import express from "express";
import {
  createDTRLog,
  getDTRLogs,
  markAllDTRLogsAsRead,
  markDTRLogAsRead,
} from "../controllers/dtrGenerationLogController.js";

const router = express.Router();

router.post("/", createDTRLog);
router.get("/", getDTRLogs);

router.put("/read-all", markAllDTRLogsAsRead); // ✅ must be before :id
router.put("/:id/read", markDTRLogAsRead);

export default router;
