import express from "express";
import {getDTRDataList} from "../controllers/dtrDataController.js";


const router = express.Router();

router.get("/", getDTRDataList);

export default router;

