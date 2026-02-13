import express from "express";
import { getDemoInfo, getPublicSecuritySettings } from "../controllers/settingsController.js";
import { reportBug } from "../controllers/bugReportController.js";
import { logDemoImport } from "../controllers/demoController.js";
import { getDeploymentNotes } from "../controllers/devController.js";

const router = express.Router();

router.get("/demo-info", getDemoInfo);
router.get("/security-settings", getPublicSecuritySettings);
router.post("/bug-report", reportBug);
router.post("/demo-import-log", logDemoImport);
// Public instructions endpoint to surface deployment/user instructions app-wide
router.get("/instructions", getDeploymentNotes);

export default router;
