import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { login, me } from '../controllers/authController.js';
import { requestStaffCode, verifyStaffCode } from '../controllers/otpController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const tooMany = (message) => (_request, response) => response.status(429).json({ error: { message } });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Too many login attempts. Try again later.'),
});
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Too many code requests. Try again later.'),
});
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Too many attempts. Try again later.'),
});

router.post(
  '/login',
  loginLimiter,
  validate(
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').isString().notEmpty().withMessage('Password is required.'),
  ),
  asyncHandler(login),
);
router.post(
  '/otp/request',
  otpRequestLimiter,
  validate(body('identifier').isString().trim().notEmpty().withMessage('Email or phone is required.')),
  asyncHandler(requestStaffCode),
);
router.post(
  '/otp/verify',
  otpVerifyLimiter,
  validate(
    body('identifier').isString().trim().notEmpty().withMessage('Email or phone is required.'),
    body('code').isString().matches(/^\d{6}$/).withMessage('Enter the 6-digit code.'),
  ),
  asyncHandler(verifyStaffCode),
);
router.get('/me', authenticate, asyncHandler(me));

export default router;