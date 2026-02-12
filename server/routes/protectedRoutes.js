import express from 'express';
import verifyToken from '../middleware/authMiddleware.js'; 
import { requirePermissions } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get(
  '/admin-data',
  verifyToken,
  requirePermissions(["isAdmin"], { allowAdmin: false, allowDeveloper: false }),
  (req, res) => {
  res.json({
    message: 'Welcome Admin!',
    userId: req.user.id,
  });
  }
);

export default router;