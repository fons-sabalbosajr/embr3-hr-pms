import express from "express";
import { createPayslipRequest, getPayslipRequests } from "../controllers/payslipRequestController.js";

const router = express.Router();

router.post("/", createPayslipRequest);
router.get("/", getPayslipRequests); // <-- added

export default router;
