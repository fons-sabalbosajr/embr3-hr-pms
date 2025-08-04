import express from 'express';
import {
  signup,
  login,
  verifyEmail,
  resendVerification,
} from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/verify/:token', verifyEmail);
router.post('/resend', resendVerification);

export default router;
