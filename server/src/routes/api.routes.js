import { Router } from 'express';
import authRouter from './auth.routes.js';
import citizenRouter from './citizen.routes.js';
import dashboardRouter from './dashboard.routes.js';
import healthRouter from './health.routes.js';
import householdRouter from './household.routes.js';
import pickupRouter from './pickup.routes.js';
import wardRouter from './ward.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/households', householdRouter);
router.use('/pickup-logs', pickupRouter);
router.use('/citizen', citizenRouter);
router.use('/dashboard', dashboardRouter);
router.use('/wards', wardRouter);

export default router;