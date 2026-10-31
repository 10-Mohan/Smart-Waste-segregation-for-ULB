import { DataTypes } from 'sequelize';
import { sequelize } from '../src/config/database.js';
import OtpCode from '../src/models/OtpCode.js';

const dialect = sequelize.getDialect();
console.log(`Dialect: ${dialect}  Host: ${sequelize.config.host || '(local file)'}`);
if (dialect === 'postgres' && !process.argv.includes('--yes')) {
  console.log('Refusing to touch PostgreSQL without --yes.');
  process.exit(1);
}

await OtpCode.sync();
console.log('OtpCodes table ready.');

const qi = sequelize.getQueryInterface();
const columns = await qi.describeTable('Households');
if (!columns.email) {
  await qi.addColumn('Households', 'email', { type: DataTypes.STRING, allowNull: true });
  await qi.addIndex('Households', ['email'], { unique: true, name: 'households_email_unique' });
  console.log('Households.email added.');
} else {
  console.log('Households.email already exists.');
}

await sequelize.close();