import express from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";
import { getFeatureMaintenanceStatus } from "../middleware/maintenanceMiddleware.js";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";

const router = express.Router();

// All routes here are protected
router.use(verifyToken);

router
	.route("/")
	.get(requirePermissions(["canAccessSettings"]), getSettings)
	.put(requirePermissions(["canAccessSettings"]), updateSettings);

// Feature-maintenance status (any authenticated user can fetch)
router.get("/feature-maintenance", getFeatureMaintenanceStatus);

export default router;