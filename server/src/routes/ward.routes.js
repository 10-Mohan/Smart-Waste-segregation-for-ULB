import { Router } from 'express';
import { listWards } from '../controllers/wardController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, asyncHandler(listWards));

export default router;