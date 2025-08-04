import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js'; 

const router = express.Router();

router.get('/admin-data', verifyToken, (req, res) => {
  res.json({
    message: 'Welcome Admin!',
    userId: req.user.id,
  });
});

export default router;
