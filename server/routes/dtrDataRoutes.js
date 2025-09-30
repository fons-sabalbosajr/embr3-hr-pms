import express from "express";
import { getDTRDataList, checkDTRData } from "../controllers/dtrDataController.js";


const router = express.Router();

router.get("/", getDTRDataList);
router.get("/check", checkDTRData);

export default router;