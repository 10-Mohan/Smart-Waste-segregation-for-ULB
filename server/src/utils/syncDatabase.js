import 'dotenv/config';
import { sequelize } from '../models/index.js';

try {
  await sequelize.sync();
  console.log('Database tables synchronized.');
} catch (error) {
  console.error('Database synchronization failed:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}