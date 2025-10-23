import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
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

router.get("/", getAllTrainings);
router.get("/:id", getTrainingById);
router.post("/", createTraining);
router.put("/:id", updateTraining);
router.delete("/:id", deleteTraining);
router.get("/by-employee/:empId", getTrainingsByEmployee);

export default router;
