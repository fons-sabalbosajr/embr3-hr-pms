import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  getDTRDataList,
  checkDTRData,
  deleteDTRDataJob,
  getDeleteJobProgress,
  updateDTRData,
} from "../controllers/dtrDataController.js";

const router = express.Router();

// ── Public read-only routes (no auth required) ──
// Used by the public Employee Request Portal pages
router.get("/public", getDTRDataList);
router.get("/public/check", checkDTRData);

router.use(verifyToken);

router.get("/", requirePermissions(["canViewDTR"]), getDTRDataList);
router.get("/check", requirePermissions(["canViewDTR"]), checkDTRData);
router.delete("/:id", requirePermissions(["canProcessDTR"]), deleteDTRDataJob);
router.get(
  "/delete-progress/:jobId",
  requirePermissions(["canProcessDTR"]),
  getDeleteJobProgress
);
router.put("/:id", requirePermissions(["canProcessDTR"]), updateDTRData);

export default router;
