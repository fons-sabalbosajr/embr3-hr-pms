import express from "express";
import { getDemoInfo } from "../controllers/settingsController.js";
import { reportBug } from "../controllers/bugReportController.js";
import { logDemoImport } from "../controllers/demoController.js";

const router = express.Router();

router.get("/demo-info", getDemoInfo);
router.post("/bug-report", reportBug);
router.post("/demo-import-log", logDemoImport);

export default router;
