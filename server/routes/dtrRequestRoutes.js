import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  createDTRRequest,
  getDTRRequests,
  markAllDTRRequestsAsRead,
  markDTRRequestAsRead,
  updateDTRRequest,
  deleteDTRRequest,
  sendDTREmail,
} from "../controllers/dtrRequestController.js";

const router = express.Router();

// Public create endpoint (can be called by landing or public form)
router.post("/", createDTRRequest);
// Admin endpoints
router.get("/", verifyToken, requirePermissions(["canViewDTR"]), getDTRRequests);
router.put(
  "/:id/read",
  verifyToken,
  requirePermissions(["canViewDTR"]),
  markDTRRequestAsRead
);
router.put(
  "/:id",
  verifyToken,
  requirePermissions(["canProcessDTR"]),
  updateDTRRequest
);
router.put(
  "/read-all",
  verifyToken,
  requirePermissions(["canViewDTR"]),
  markAllDTRRequestsAsRead
);
router.delete(
  "/:id",
  verifyToken,
  requirePermissions(["canProcessDTR"]),
  deleteDTRRequest
);
router.post(
  "/:id/send-email",
  verifyToken,
  requirePermissions(["canProcessDTR"]),
  sendDTREmail
);

export default router;
