import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, query } from 'express-validator';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listScorecards, myRatings, ratePickup } from '../controllers/ratingController.js';

const router = Router();

const ratingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATING_RATE_LIMIT_MAX) || 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ error: { message: 'Too many rating requests. Try again later.' } }),
});

// Citizen rates a pickup (same QR code + last 4 digits check as the rest of the citizen app).
router.post(
  '/citizen',
  ratingLimiter,
  validate(
    body('qrCode').isString().trim().notEmpty().withMessage('qrCode is required.'),
    body('phoneLast4').matches(/^\d{4}$/).withMessage('phoneLast4 must contain four digits.'),
    body('pickupLogId').isInt({ min: 1 }).withMessage('pickupLogId is required.'),
    body('stars').isInt({ min: 1, max: 5 }).withMessage('Choose 1 to 5 stars.'),
    body('comment').optional({ nullable: true }).isString().isLength({ max: 500 }).withMessage('Comment must be at most 500 characters.'),
  ),
  asyncHandler(ratePickup),
);

// A worker's own average and recent comments (no household names).
router.get('/mine', authenticate, authorize('worker'), asyncHandler(myRatings));

// Supervisor / admin worker scorecards, scoped to their ward.
router.get(
  '/scorecards',
  authenticate,
  authorize('supervisor', 'ulb_admin'),
  validate(query('wardId').optional().isInt({ min: 1 })),
  asyncHandler(listScorecards),
);

export default router;