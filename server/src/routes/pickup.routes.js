import { Router } from 'express';
import { body, query } from 'express-validator';
import { createPickupBatch, createPickupLog, listPickupLogs, pickupFields } from '../controllers/pickupController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post(
  '/batch',
  authenticate,
  authorize('worker'),
  validate(body('logs').isArray({ min: 1, max: 100 }).withMessage('logs must contain between 1 and 100 items.')),
  asyncHandler(createPickupBatch),
);
router.post(
  '/',
  authenticate,
  authorize('worker'),
  validate(...pickupFields),
  asyncHandler(createPickupLog),
);
router.get(
  '/',
  authenticate,
  authorize('worker', 'supervisor', 'ulb_admin'),
  validate(
    query('wardId').optional().isInt({ min: 1 }),
    query('householdId').optional().isInt({ min: 1 }),
    query('status').optional().isIn(['segregated', 'mixed', 'rejected']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ),
  asyncHandler(listPickupLogs),
);

export default router;