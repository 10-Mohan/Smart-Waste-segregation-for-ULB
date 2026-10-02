import { Router } from 'express';

const router = Router();

router.get('/', (_request, response) => {
  response.json({ status: 'ok', time: new Date().toISOString() });
});

export default router;