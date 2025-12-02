import express from "express";
import { getDTRDataList, checkDTRData, deleteDTRDataJob, getDeleteJobProgress } from "../controllers/dtrDataController.js";


const router = express.Router();

router.get("/", getDTRDataList);
router.get("/check", checkDTRData);
router.delete("/:id", deleteDTRDataJob);
router.get("/delete-progress/:jobId", getDeleteJobProgress);

export default router;