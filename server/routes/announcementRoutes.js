import { Router } from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  getAnnouncements,
  getActiveAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  dismissAnnouncement,
  sendAnnouncementEmailBlast,
  reconstructRecipients,
  getRecipientOptions,
  getEmployeesWithEmails,
} from "../controllers/announcementController.js";

const router = Router();

// Public-ish: any authenticated user can see active announcements (for pop-up)
router.get("/active", verifyToken, getActiveAnnouncements);

// Dismiss (any authenticated user)
router.put("/:id/dismiss", verifyToken, dismissAnnouncement);

// Admin / notification managers only
router.get("/recipients-options", verifyToken, requirePermissions(["canManageNotifications"]), getRecipientOptions);
router.get("/employees-emails", verifyToken, requirePermissions(["canManageNotifications"]), getEmployeesWithEmails);
router.get("/", verifyToken, requirePermissions(["canManageNotifications"]), getAnnouncements);
router.post("/", verifyToken, requirePermissions(["canManageNotifications"]), createAnnouncement);
router.put("/:id", verifyToken, requirePermissions(["canManageNotifications"]), updateAnnouncement);
router.delete("/:id", verifyToken, requirePermissions(["canManageNotifications"]), deleteAnnouncement);
router.post("/:id/send-email", verifyToken, requirePermissions(["canManageNotifications"]), sendAnnouncementEmailBlast);
router.patch("/:id/reconstruct-recipients", verifyToken, requirePermissions(["canManageNotifications"]), reconstructRecipients);

export default router;
