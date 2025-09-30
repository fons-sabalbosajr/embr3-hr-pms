import express from "express";
import { createPayslipRequest } from "../controllers/payslipRequestController.js";

const router = express.Router();

router.post("/", createPayslipRequest);

export default router;
