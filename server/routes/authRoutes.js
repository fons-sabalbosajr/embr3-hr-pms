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
  updateUserAccess,
} from '../controllers/authController.js';
import verifyToken from '../middleware/authMiddleware.js';

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
router.get('/', verifyToken, getAllUsers);
router.get('/:id', verifyToken, getUserById);
router.put('/:id/access', verifyToken, updateUserAccess);

export default router;