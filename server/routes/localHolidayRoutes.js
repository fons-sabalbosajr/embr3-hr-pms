import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { list, create, update, remove } from '../controllers/localHolidayController.js';

const router = express.Router();
// Public, read-only access for date-range listing (used by public DTR preview)
router.get('/public', list);

router.get('/', verifyToken, list);
router.post('/', verifyToken, create);
router.put('/:id', verifyToken, update);
router.delete('/:id', verifyToken, remove);

export default router;
