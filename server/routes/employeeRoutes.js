import express from 'express';

import { uploadEmployees, getEmployees, updateEmployeeById } from '../controllers/employeeController.js';

const router = express.Router();

router.post('/upload-employees', uploadEmployees);
router.get('/', getEmployees);
router.put('/:id', updateEmployeeById);

export default router;
