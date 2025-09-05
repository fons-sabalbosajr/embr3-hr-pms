import express from "express";
import {
  getAllTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
  getTrainingsByEmployee,
} from "../controllers/trainingController.js";

const router = express.Router();

router.get("/", getAllTrainings);
router.get("/:id", getTrainingById);
router.post("/", createTraining);
router.put("/:id", updateTraining);
router.delete("/:id", deleteTraining);
router.get("/by-employee/:empId", getTrainingsByEmployee);

export default router;
