import express from 'express';
import {
  signup,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  updateUserProfile,
  changePassword,
  updateUserPreferences,
  getUserById,
  getAllUsers,
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/verify/:token', verifyEmail);
router.post('/resend', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Authenticated routes
router.put('/profile', verifyToken, updateUserProfile);
router.put('/change-password', verifyToken, changePassword);
router.put('/preferences', verifyToken, updateUserPreferences);
router.get('/:id', verifyToken, getUserById);
router.get('/users', verifyToken, getAllUsers);

export default router;
