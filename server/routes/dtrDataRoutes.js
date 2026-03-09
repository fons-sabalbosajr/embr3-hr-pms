import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  getDTRDataList,
  checkDTRData,
  deleteDTRDataJob,
  getDeleteJobProgress,
  updateDTRData,
  mergeDTRData,
  previewMergeDTRData,
  startMergeDTRData,
  getMergeProgress,
  cancelMerge,
  moveLogsToTarget,
  previewContainer,
  createContainer,
  getContainerProgress,
  unmergeChildPeriod,
  getUnmergeProgress,
  cancelUnmerge,
} from "../controllers/dtrDataController.js";

const router = express.Router();

// ── Public read-only routes (no auth required) ──
// Used by the public Employee Request Portal pages
router.get("/public", getDTRDataList);
router.get("/public/check", checkDTRData);

router.use(verifyToken);

router.get("/", requirePermissions(["canViewDTR"]), getDTRDataList);
router.get("/check", requirePermissions(["canViewDTR"]), checkDTRData);
router.get("/merge-progress/:jobId", requirePermissions(["canProcessDTR"]), getMergeProgress);
router.post("/merge-cancel/:jobId", requirePermissions(["canProcessDTR"]), cancelMerge);
router.get(
  "/delete-progress/:jobId",
  requirePermissions(["canProcessDTR"]),
  getDeleteJobProgress
);

// DTR Data Container (compile old records) — before parameterized routes
router.post("/container-preview", requirePermissions(["canProcessDTR"]), previewContainer);
router.post("/container-create", requirePermissions(["canProcessDTR"]), createContainer);
router.get("/container-progress/:jobId", requirePermissions(["canProcessDTR"]), getContainerProgress);
router.get("/unmerge-progress/:jobId", requirePermissions(["canProcessDTR"]), getUnmergeProgress);
router.post("/unmerge-cancel/:jobId", requirePermissions(["canProcessDTR"]), cancelUnmerge);

router.delete("/:id", requirePermissions(["canProcessDTR"]), deleteDTRDataJob);
router.put("/:id", requirePermissions(["canProcessDTR"]), updateDTRData);
router.post("/:targetId/merge", requirePermissions(["canProcessDTR"]), mergeDTRData);
router.post("/:targetId/merge-preview", requirePermissions(["canProcessDTR"]), previewMergeDTRData);
router.post("/:targetId/merge-start", requirePermissions(["canProcessDTR"]), startMergeDTRData);
router.post("/:targetId/move-logs", requirePermissions(["canProcessDTR"]), moveLogsToTarget);
router.post("/:containerId/unmerge", requirePermissions(["canProcessDTR"]), unmergeChildPeriod);

export default router;
