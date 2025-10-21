import express from "express";
import { checkDTRExistsForRange, createDTRRequest, getDTRRequests, debugResolveDTR } from "../controllers/dtrRequestController.js";

const router = express.Router();

// Public endpoints similar to payslip request
router.get("/check", checkDTRExistsForRange);
router.post("/", createDTRRequest);
router.get("/", getDTRRequests);
router.get("/debug/resolve", debugResolveDTR);

export default router;
