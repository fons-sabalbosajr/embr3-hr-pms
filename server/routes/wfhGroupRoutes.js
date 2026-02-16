import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  listGroups,
  publicListGroups,
  createGroup,
  updateGroup,
  removeGroup,
} from "../controllers/wfhGroupController.js";

const router = express.Router();

// ── Public (no auth) — used by DTR / WorkCalendar ──
router.get("/public", publicListGroups);

// ── Auth-protected routes ──
router.get("/", verifyToken, requirePermissions(["canViewDTR"]), listGroups);
router.post("/", verifyToken, requirePermissions(["canProcessDTR"]), createGroup);
router.put("/:id", verifyToken, requirePermissions(["canProcessDTR"]), updateGroup);
router.delete("/:id", verifyToken, requirePermissions(["canProcessDTR"]), removeGroup);

export default router;
