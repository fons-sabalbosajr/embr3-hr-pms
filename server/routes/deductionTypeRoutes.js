import express from "express";
const router = express.Router();
import {
  getDeductionTypes,
  createDeductionType,
  updateDeductionType,
  deleteDeductionType,
} from "../controllers/deductionTypeController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";

router.use(authMiddleware); // Protect all routes

router
  .route("/")
  .get(requirePermissions(["canChangeDeductions"]), getDeductionTypes)
  .post(requirePermissions(["canChangeDeductions"]), createDeductionType);
router
  .route("/:id")
  .put(requirePermissions(["canChangeDeductions"]), updateDeductionType)
  .delete(requirePermissions(["canChangeDeductions"]), deleteDeductionType);

export default router;
