import express from "express";
import multer from "multer";
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
  scanAttendance,
  rematchNames,
} from "../controllers/trainingController.js";

const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PDF, JPEG, PNG, or WebP files are allowed"));
    }
    cb(null, true);
  },
});

const router = express.Router();

// Public, read-only endpoint for trainings by employee (limited fields)
router.get("/public/by-employee/:empId", getTrainingsByEmployeePublic);

// Require authentication so we can enforce role-based visibility of resigned participants
router.use(verifyToken);

router.get("/", requirePermissions(["canViewTrainings"]), getAllTrainings);
router.post(
  "/scan-attendance",
  requirePermissions(["canEditTrainings"]),
  scanUpload.single("file"),
  scanAttendance
);
router.post(
  "/rematch-names",
  requirePermissions(["canEditTrainings"]),
  rematchNames
);
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
