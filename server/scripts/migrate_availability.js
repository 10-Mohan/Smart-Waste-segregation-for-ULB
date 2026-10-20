import { sequelize, Household, PickupLog } from '../src/models/index.js';

// Additive-only migration: adds Households.awayUntil / preferredWindow and the
// 'not_available' pickup status. Safe to run more than once. Never deletes data.

const dialect = sequelize.getDialect();
const confirmed = process.argv.includes('--yes');

function tableNameOf(model) {
  const name = model.getTableName();
  return typeof name === 'string' ? name : name.tableName;
}

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

  const queryInterface = sequelize.getQueryInterface();
  const householdTable = tableNameOf(Household);
  const columns = await queryInterface.describeTable(householdTable);
  let changed = false;

  if (!columns.awayUntil) {
    await queryInterface.addColumn(householdTable, 'awayUntil', { type: 'DATE', allowNull: true });
    console.log('Added column awayUntil.');
    changed = true;
  }
  if (!columns.preferredWindow) {
    await queryInterface.addColumn(householdTable, 'preferredWindow', { type: 'VARCHAR(255)', allowNull: true });
    console.log('Added column preferredWindow.');
    changed = true;
  }

  if (dialect === 'postgres') {
    const [rows] = await sequelize.query(
      `SELECT t.typname AS typname
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_type t ON t.oid = a.atttypid
        WHERE c.relname = :table AND a.attname = 'status' AND t.typtype = 'e'`,
      { replacements: { table: tableNameOf(PickupLog) } },
    );
    if (rows.length) {
      const typeName = String(rows[0].typname).replace(/"/g, '""');
      await sequelize.query(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'not_available'`);
      console.log(`Ensured status value 'not_available' exists on enum "${rows[0].typname}".`);
    } else {
      console.log('PickupLogs.status is not an enum type; nothing to change there.');
    }
  } else {
    console.log('SQLite: status column needs no enum change.');
  }

  console.log(changed ? 'Migration finished: changes applied.' : 'Nothing to do: already up to date.');
}

main()
  .then(async () => { await sequelize.close(); })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });