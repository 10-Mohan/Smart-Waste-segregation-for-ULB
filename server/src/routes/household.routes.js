import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createHousehold,
  getHousehold,
  getHouseholdByQr,
  getHouseholdQr,
  listHouseholds,
} from '../controllers/householdController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const householdRoles = authorize('worker', 'supervisor', 'ulb_admin');

router.use(authenticate, householdRoles);
router.post(
  '/',
  validate(
    body('ownerName').isString().trim().notEmpty().withMessage('Owner name is required.'),
    body('phone').matches(/^[6-9]\d{9}$/).withMessage('Phone must be a valid Indian 10-digit mobile number.'),
    body('address').isString().trim().notEmpty().withMessage('Address is required.'),
    body('type').isIn(['residential', 'commercial']).withMessage('Type must be residential or commercial.'),
    body('wardId').isInt({ min: 1 }).withMessage('A valid wardId is required.'),
  ),
  asyncHandler(createHousehold),
);
router.get(
  '/',
  validate(
    query('wardId').optional().isInt({ min: 1 }),
    query('type').optional().isIn(['residential', 'commercial']),
    query('search').optional().isString().trim().isLength({ max: 100 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ),
  asyncHandler(listHouseholds),
);
router.get('/by-qr/:qrCode', validate(param('qrCode').isString().trim().notEmpty()), asyncHandler(getHouseholdByQr));
router.get('/:id/qr', validate(param('id').isInt({ min: 1 })), asyncHandler(getHouseholdQr));
router.get('/:id', validate(param('id').isInt({ min: 1 })), asyncHandler(getHousehold));

export default router;