// routes/dtrGenerationLogRoutes.js
import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  createDTRLog,
  getDTRLogs,
  markAllDTRLogsAsRead,
  markDTRLogAsRead,
  updateDTRGenerationLog,
  deleteDTRGenerationLog,
} from "../controllers/dtrGenerationLogController.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", requirePermissions(["canProcessDTR"]), createDTRLog);
router.get("/", requirePermissions(["canViewDTR"]), getDTRLogs);

router.put(
  "/read-all",
  requirePermissions(["canViewDTR"]),
  markAllDTRLogsAsRead
); // ✅ must be before :id
router.put(
  "/:id/read",
  requirePermissions(["canViewDTR"]),
  markDTRLogAsRead
);
router.put(
  "/:id",
  requirePermissions(["canProcessDTR"]),
  updateDTRGenerationLog
);
router.delete(
  "/:id",
  requirePermissions(["canProcessDTR"]),
  deleteDTRGenerationLog
);

export default router;
