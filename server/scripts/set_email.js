import { sequelize } from '../src/config/database.js';
import { Household, User } from '../src/models/index.js';

const args = process.argv.slice(2);
const [kind, target, newEmail] = args.filter((arg) => !arg.startsWith('--'));
const dialect = sequelize.getDialect();
console.log(`Dialect: ${dialect}  Host: ${sequelize.config.host || '(local file)'}`);
if (dialect === 'postgres' && !args.includes('--yes')) {
  console.log('Refusing to touch PostgreSQL without --yes.');
  process.exit(1);
}

try {
  if (kind === 'list') {
    const staff = await User.findAll({ attributes: ['id', 'email', 'role'], order: [['id', 'ASC']] });
    console.table(staff.map((user) => user.toJSON()));
    const households = await Household.findAll({ attributes: ['qrCode', 'ownerName', 'email'], order: [['id', 'ASC']], limit: 10 });
    console.table(households.map((household) => household.toJSON()));
  } else if (kind === 'staff' || kind === 'household') {
    if (!target || !newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      throw new Error('Usage: node scripts/set_email.js <staff|household> <current-email|qrCode> <new-email> [--yes]');
    }
    const email = newEmail.trim().toLowerCase();
    const record = kind === 'staff'
      ? await User.findOne({ where: { email: target } })
      : await Household.findOne({ where: { qrCode: target } });
    if (!record) throw new Error(`No ${kind} found for "${target}".`);
    await record.update({ email });
    console.log(`Updated ${kind} "${target}" -> ${email}`);
  } else {
    throw new Error('First argument must be list, staff or household.');
  }
} catch (error) {
  console.error(error.name === 'SequelizeUniqueConstraintError' ? 'That email is already used by another record.' : error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}