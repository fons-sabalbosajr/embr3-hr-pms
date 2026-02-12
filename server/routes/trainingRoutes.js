import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";
import {
  getAllTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
  getTrainingsByEmployee,
  getTrainingsByEmployeePublic,
} from "../controllers/trainingController.js";

const router = express.Router();

// Public, read-only endpoint for trainings by employee (limited fields)
router.get("/public/by-employee/:empId", getTrainingsByEmployeePublic);

// Require authentication so we can enforce role-based visibility of resigned participants
router.use(verifyToken);

router.get("/", requirePermissions(["canViewTrainings"]), getAllTrainings);
router.get("/:id", requirePermissions(["canViewTrainings"]), getTrainingById);
router.post("/", requirePermissions(["canEditTrainings"]), createTraining);
router.put("/:id", requirePermissions(["canEditTrainings"]), updateTraining);
router.delete("/:id", requirePermissions(["canEditTrainings"]), deleteTraining);
router.get(
  "/by-employee/:empId",
  requirePermissions(["canViewTrainings"]),
  getTrainingsByEmployee
);

export default router;
