import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import {
  createDTRRequest,
  getDTRRequests,
  markAllDTRRequestsAsRead,
  markDTRRequestAsRead,
  updateDTRRequest,
  deleteDTRRequest,
} from "../controllers/dtrRequestController.js";

const router = express.Router();

// Public create endpoint (can be called by landing or public form)
router.post("/", createDTRRequest);
// Admin endpoints
router.get("/", getDTRRequests);
router.put("/:id/read", verifyToken, markDTRRequestAsRead);
router.put("/:id", verifyToken, updateDTRRequest);
router.put("/read-all", verifyToken, markAllDTRRequestsAsRead);
router.delete("/:id", verifyToken, deleteDTRRequest);

export default router;
