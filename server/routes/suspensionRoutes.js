import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { list, create, update, remove } from '../controllers/suspensionController.js';
import { upload, bulkUploadSuspensions } from '../controllers/bulkCalendarUploadController.js';
import { requirePermissions } from '../middleware/permissionMiddleware.js';

const router = express.Router();
// Public, read-only access for date-range listing (used by public DTR preview)
router.get('/public', list);

router.get('/', verifyToken, requirePermissions(["canViewDTR"]), list);
router.post('/', verifyToken, requirePermissions(["canProcessDTR"]), create);
router.put('/:id', verifyToken, requirePermissions(["canProcessDTR"]), update);
router.delete('/:id', verifyToken, requirePermissions(["canProcessDTR"]), remove);
router.post(
	'/bulk-upload',
	verifyToken,
	requirePermissions(["canProcessDTR"]),
	(req,res,next)=>upload(req,res,(err)=>{ if (err) return res.status(400).json({success:false,message:err.message}); next(); }),
	bulkUploadSuspensions
);

export default router;
