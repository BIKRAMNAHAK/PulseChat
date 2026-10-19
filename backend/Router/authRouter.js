const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../Controller/authController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../db_config/multer_config');

// Rate limiter for OTP requests (max 5 requests per 10 minutes per IP)
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many OTP requests from this IP. Please try again after 10 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for Login attempts (max 10 attempts per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
router.post('/send-otp', otpLimiter, authController.sendOtp);
router.post('/register', upload.single('profilePic'), authController.register);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
