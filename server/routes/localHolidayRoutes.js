import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { list, create, update, remove } from '../controllers/localHolidayController.js';
import { upload, bulkUploadLocalHolidays } from '../controllers/bulkCalendarUploadController.js';

const router = express.Router();
// Public, read-only access for date-range listing (used by public DTR preview)
router.get('/public', list);

router.get('/', verifyToken, list);
router.post('/', verifyToken, create);
router.put('/:id', verifyToken, update);
router.delete('/:id', verifyToken, remove);
router.post('/bulk-upload', verifyToken, (req,res,next)=>upload(req,res,(err)=>{ if (err) return res.status(400).json({success:false,message:err.message}); next(); }), bulkUploadLocalHolidays);

export default router;
