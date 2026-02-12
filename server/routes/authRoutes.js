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
  requestPasswordChange,
  confirmPasswordChange,
  updateUserPreferences,
  getUserById,
  getAllUsers,
  logout,
  updateUserAccess,
  devResetPassword,
  uploadAvatar,
  getPendingSignups,
  approveSignup,
  rejectSignup,
  deleteUser,
} from '../controllers/authController.js';
import verifyToken from '../middleware/authMiddleware.js';
import multer from 'multer';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/verify/:token', verifyEmail);
router.post('/resend', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
// Development-only password reset (requires DEV_RESET_TOKEN and non-production)
router.post('/dev-reset', devResetPassword);

// Authenticated routes
router.put('/profile', verifyToken, updateUserProfile);
// Alias routes matching existing front-end expectations
router.put('/users/profile', verifyToken, updateUserProfile);
router.put('/change-password', verifyToken, changePassword);
// Two-step password change
router.post('/request-password-change', verifyToken, requestPasswordChange);
// Public confirm endpoint (token-based)
router.post('/confirm-password-change', confirmPasswordChange);
// Legacy alias (front-end currently calling /users/change-password)
router.put('/users/change-password', verifyToken, changePassword);
router.put('/preferences', verifyToken, updateUserPreferences);
// Avatar upload
router.post('/avatar', verifyToken, upload.single('avatar'), uploadAvatar);
router.get('/', verifyToken, getAllUsers);
// Signup approval management (must be before /:id to avoid matching "signups" as an ObjectId)
router.get('/signups', verifyToken, getPendingSignups);
router.get('/:id', verifyToken, getUserById);
router.post('/logout', logout);
router.put('/:userId/access', verifyToken, updateUserAccess);
router.put('/:userId/approve', verifyToken, approveSignup);
router.put('/:userId/reject', verifyToken, rejectSignup);
router.delete('/:userId', verifyToken, deleteUser);

export default router;