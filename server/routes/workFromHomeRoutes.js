import express from "express";
import multer from "multer";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  list,
  publicList,
  create,
  update,
  remove,
  uploadAttachment,
} from "../controllers/workFromHomeController.js";

const router = express.Router();

// Multer – memory storage, max 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Public (no auth) — used by WorkCalendar ──
router.get("/public", publicList);

// ── Auth-protected routes ──
router.get("/", verifyToken, requirePermissions(["canViewDTR"]), list);
router.post("/", verifyToken, requirePermissions(["canProcessDTR"]), create);
router.put("/:id", verifyToken, requirePermissions(["canProcessDTR"]), update);
router.delete("/:id", verifyToken, requirePermissions(["canProcessDTR"]), remove);

// ── Upload attachment to Google Drive ──
router.post(
  "/upload",
  verifyToken,
  requirePermissions(["canProcessDTR"]),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res
          .status(400)
          .json({ success: false, message: err.message || "Upload error" });
      }
      next();
    });
  },
  uploadAttachment
);

export default router;
