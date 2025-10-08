import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { getDevConfig } from "../controllers/devController.js";

const router = express.Router();

// Protected route; front-end can additionally gate to admins
router.use(verifyToken);

router.get("/config", getDevConfig);

export default router;
