import { sequelize, PickupRating } from '../src/models/index.js';

// Additive-only migration: creates the PickupRatings table if it does not exist.
// Never drops, alters or deletes anything. Safe to run more than once.

const dialect = sequelize.getDialect();
const confirmed = process.argv.includes('--yes');

async function main() {
  const host = sequelize.config.host || sequelize.options.storage || 'local file';
  console.log(`Dialect: ${dialect}`);
  console.log(`Database host: ${host}`);

  if (dialect === 'postgres') {
    if (!process.env.DATABASE_URL) {
      console.error('Refusing to run: PostgreSQL selected but DATABASE_URL is not set.');
      process.exit(1);
    }
    if (!confirmed) {
      console.error('Refusing to run against PostgreSQL without --yes (to avoid accidents).');
      process.exit(1);
    }
  }

  const tableName = PickupRating.getTableName();
  const name = typeof tableName === 'string' ? tableName : tableName.tableName;
  const existing = (await sequelize.getQueryInterface().showAllTables())
    .map((table) => (typeof table === 'string' ? table : table.tableName));

  if (existing.includes(name)) {
    console.log(`Nothing to do: table ${name} already exists.`);
    return;
  }

  await PickupRating.sync(); // CREATE TABLE IF NOT EXISTS
  console.log(`Created table ${name}.`);
}

main()
  .then(async () => { await sequelize.close(); })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });   