import { Router } from 'express';
import { sequelize } from '../config/database.js';

const router = Router();

router.get('/', async (_request, response) => {
  try {
    await sequelize.authenticate();
    response.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
  } catch (error) {
    response.status(503).json({ status: 'error', db: 'down', time: new Date().toISOString() });
  }
});

export default router;