import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, query } from 'express-validator';
import { Household, Ward } from '../models/index.js';
import { citizenStatus, citizenWards, registerCitizenHousehold } from '../controllers/citizenController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const citizenLimiterWindowMinutes = Number(process.env.CITIZEN_STATUS_RATE_LIMIT_WINDOW_MINUTES) || 15;
const citizenLimiterMax = Number(process.env.CITIZEN_STATUS_RATE_LIMIT_MAX) || 30;
const citizenLimiter = rateLimit({
  windowMs: citizenLimiterWindowMinutes * 60 * 1000,
  limit: citizenLimiterMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ error: { message: 'Too many household status requests. Try again later.' } }),
});

const registrationLimiterWindowMinutes = Number(process.env.REGISTER_RATE_LIMIT_WINDOW_MINUTES) || 60;
const registrationLimiterMax = Number(process.env.REGISTER_RATE_LIMIT_MAX) || 5;
const registrationLimiter = rateLimit({
  windowMs: registrationLimiterWindowMinutes * 60 * 1000,
  limit: registrationLimiterMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ error: { message: 'Too many registrations from this connection. Please try again later.' } }),
});

router.get('/wards', asyncHandler(citizenWards));
router.post(
  '/register',
  registrationLimiter,
  validate(
    body('ownerName').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters.'),
    body('phone').matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit Indian mobile number.'),
    body('address').isString().trim().isLength({ min: 5, max: 200 }).withMessage('Address must be between 5 and 200 characters.'),
    body('type').isIn(['residential', 'commercial']).withMessage('Choose home or shop/business.'),
    body('wardId').isInt({ min: 1 }).withMessage('Choose a ward.').bail().custom(async (wardId) => Boolean(await Ward.findByPk(wardId))),
    body('consent').custom((consent) => consent === true).withMessage('Please agree to use of your household details.'),
  ),
  asyncHandler(registerCitizenHousehold),
);

router.get(
  '/status',
  citizenLimiter,
  validate(
    query('qrCode').isString().trim().notEmpty().withMessage('qrCode is required.'),
    query('phoneLast4').matches(/^\d{4}$/).withMessage('phoneLast4 must contain four digits.'),
  ),
  asyncHandler(citizenStatus),
);

export default router;