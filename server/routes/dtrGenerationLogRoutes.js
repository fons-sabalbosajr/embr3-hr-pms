// routes/dtrGenerationLogRoutes.js
import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import {
  createDTRLog,
  getDTRLogs,
  markAllDTRLogsAsRead,
  markDTRLogAsRead,
  updateDTRGenerationLog,
  deleteDTRGenerationLog,
} from "../controllers/dtrGenerationLogController.js";

const router = express.Router();

router.post("/", createDTRLog);
router.get("/", getDTRLogs);

router.put("/read-all", markAllDTRLogsAsRead); // ✅ must be before :id
router.put("/:id/read", markDTRLogAsRead);
router.put("/:id", verifyToken, updateDTRGenerationLog);
router.delete("/:id", verifyToken, deleteDTRGenerationLog);

export default router;
