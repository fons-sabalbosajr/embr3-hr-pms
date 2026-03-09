import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  searchBiometricLogs,
  getResolutions,
  saveResolution,
  bulkSaveResolutions,
  deleteResolution,
} from "../controllers/dtrResolutionController.js";

const router = express.Router();

router.use(verifyToken);

router.get("/search-biometric", requirePermissions(["canViewDTR"]), searchBiometricLogs);
router.get("/", requirePermissions(["canViewDTR"]), getResolutions);
router.post("/bulk", requirePermissions(["canProcessDTR"]), bulkSaveResolutions);
router.post("/", requirePermissions(["canProcessDTR"]), saveResolution);
router.delete("/:id", requirePermissions(["canProcessDTR"]), deleteResolution);

export default router;
