import express from 'express';
const router = express.Router();
import {
  getDeductionTypes,
  createDeductionType,
  updateDeductionType,
  deleteDeductionType,
} from "../controllers/deductionTypeController.js";
import authMiddleware from "../middleware/authMiddleware.js";

router.use(authMiddleware); // Protect all routes

router.route("/").get(getDeductionTypes).post(createDeductionType);
router
  .route("/:id")
  .put(updateDeductionType)
  .delete(deleteDeductionType);

export default router;