import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sequelize } from 'sequelize';

const dialect = process.env.DB_DIALECT || 'sqlite';
const databaseUrl = process.env.DATABASE_URL;
const serverDirectory = fileURLToPath(new URL('../../', import.meta.url));
import pg from 'pg';

let sequelize;

if (dialect === 'sqlite') {
  const storage = databaseUrl
    ? (isAbsolute(databaseUrl) ? databaseUrl : resolve(serverDirectory, databaseUrl))
    : resolve(serverDirectory, 'data/dev.sqlite');

  mkdirSync(dirname(storage), { recursive: true });
  sequelize = new Sequelize({ dialect, storage, logging: false });
} else if (dialect === 'postgres') {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when DB_DIALECT=postgres.');
  }

  const useSsl = process.env.DB_SSL !== 'false';
  sequelize = new Sequelize(databaseUrl, {
    dialect,
    dialectModule: pg,
    logging: false,
    dialectOptions: useSsl ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    } : {},
    pool: {
      max: 5,
      min: 0,
      idle: 10000,
      acquire: 20000,
    },
  });
} else {
  throw new Error(`Unsupported DB_DIALECT: ${dialect}`);
}

export { sequelize };