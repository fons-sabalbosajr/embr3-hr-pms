import express from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes here are protected
router.use(verifyToken);

router.route("/").get(getSettings).put(updateSettings);

export default router;