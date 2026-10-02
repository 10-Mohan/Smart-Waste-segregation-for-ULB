import { Router } from 'express';
import { query } from 'express-validator';
import {
  exportCsv,
  hotspots,
  reasons,
  summary,
  trends,
  violations,
  wards,
} from '../controllers/dashboardController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const dashboardAccess = [authenticate, authorize('supervisor', 'ulb_admin')];
const periodValidation = [
  query('from').optional().isISO8601().withMessage('from must be an ISO 8601 date.'),
  query('to').optional().isISO8601().withMessage('to must be an ISO 8601 date.'),
  query('to').custom((to, { req }) => !to || !req.query.from || new Date(to) >= new Date(req.query.from))
    .withMessage('to must be on or after from.'),
  query('wardId').optional().isInt({ min: 1 }),
];

router.get('/export.csv', ...dashboardAccess, validate(...periodValidation), asyncHandler(exportCsv));
router.get('/summary', ...dashboardAccess, validate(...periodValidation), asyncHandler(summary));
router.get('/wards', ...dashboardAccess, validate(...periodValidation), asyncHandler(wards));
router.get(
  '/trends',
  ...dashboardAccess,
  validate(...periodValidation, query('granularity').optional().isIn(['day', 'week'])),
  asyncHandler(trends),
);
router.get('/hotspots', ...dashboardAccess, validate(...periodValidation), asyncHandler(hotspots));
router.get(
  '/violations',
  ...dashboardAccess,
  validate(...periodValidation, query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })),
  asyncHandler(violations),
);
router.get('/reasons', ...dashboardAccess, validate(...periodValidation), asyncHandler(reasons));

export default router;