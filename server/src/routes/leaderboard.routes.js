import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from 'express-validator';
import asyncHandler from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { getLeaderboard } from '../services/leaderboardService.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.CITIZEN_STATUS_RATE_LIMIT_MAX) || 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ error: { message: 'Too many requests. Try again later.' } }),
});

// Citizen-facing: same QR code + last 4 digits check as the status endpoint.
router.get(
  '/',
  limiter,
  validate(
    query('qrCode').isString().trim().notEmpty().withMessage('qrCode is required.'),
    query('phoneLast4').matches(/^\d{4}$/).withMessage('phoneLast4 must contain four digits.'),
  ),
  asyncHandler(async (request, response) => {
    response.json(await getLeaderboard({
      qrCode: request.query.qrCode,
      phoneLast4: request.query.phoneLast4,
    }));
  }),
);

export default router;