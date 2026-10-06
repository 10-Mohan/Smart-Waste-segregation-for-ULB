import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import {
  Household,
  Notification,
  PickupLog,
  PointsLedger,
  sequelize,
  User,
  Ward,
} from '../models/index.js';
import { calculateCompliance } from '../services/complianceService.js';
import { calculatePoints } from '../services/pointsService.js';

const reset = process.argv.includes('--reset');
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const demoPassword = 'Demo@1234'; // Demo credentials only; change before any non-demo use.

const wardDefinitions = [
  { name: 'Ward 1 - Central', code: 'W01', zone: 'Central Zone' },
  { name: 'Ward 2 - North', code: 'W02', zone: 'North Zone' },
];

const householdDefinitions = [
  { wardCode: 'W01', ownerName: 'Ananya Raman', phone: '9876501001', address: '12, Poonamallee High Road, Egmore, Chennai', type: 'residential' },
  { wardCode: 'W01', ownerName: 'Ravi Kumar', phone: '9876501002', address: '4, Ritherdon Road, Vepery, Chennai', type: 'residential' },
  { wardCode: 'W01', ownerName: 'Mahalakshmi Iyer', phone: '9876501003', address: '28, Perumal Mudali Street, Sowcarpet, Chennai', type: 'residential' },
  { wardCode: 'W01', ownerName: 'Suresh Nair', phone: '9876501004', address: '17, Casa Major Road, Egmore, Chennai', type: 'commercial' },
  { wardCode: 'W01', ownerName: 'Fathima Begum', phone: '9876501005', address: '6, Halls Road, Kilpauk, Chennai', type: 'residential' },
  { wardCode: 'W02', ownerName: 'Arjun Selvan', phone: '9876502001', address: '31, Tiruvottiyur High Road, Tondiarpet, Chennai', type: 'residential' },
  { wardCode: 'W02', ownerName: 'Lakshmi Devi', phone: '9876502002', address: '9, Ennore High Road, Washermanpet, Chennai', type: 'residential' },
  { wardCode: 'W02', ownerName: 'Imran Khan', phone: '9876502003', address: '52, New Washermanpet Market Road, Chennai', type: 'commercial' },
];

const statusPlans = [
  {
    wardCode: 'W01',
    statuses: ['segregated', 'segregated', 'mixed', 'segregated', 'rejected', 'segregated', 'mixed', 'segregated', 'segregated', 'rejected', 'mixed', 'segregated', 'mixed', 'segregated'],
  },
  {
    wardCode: 'W02',
    statuses: ['segregated', 'mixed', 'rejected', 'segregated', 'mixed', 'segregated', 'mixed', 'rejected', 'segregated', 'mixed', 'segregated', 'mixed', 'segregated', 'segregated'],
  },
];

const rejectionReasons = [
  'Hazardous items in dry bin',
  'Sanitary waste mixed',
  'Wet and dry waste not separated',
  'Glass mixed with food waste',
];

function makeClientUuid(sequence) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

const withHistory = process.argv.includes('--history');

function buildPickupEvents(householdByQrCode) {
  const events = [];
  let sequence = 0;

  if (withHistory) {
    const ward1 = Array.from(householdByQrCode.values()).filter(h => h.qrCode.includes('W01'));
    const ward2 = Array.from(householdByQrCode.values()).filter(h => h.qrCode.includes('W02'));
    
    // Generate about 150 historical logs over the past 60 days (excluding the last 14 days covered by statusPlans)
    const startDate = Date.now() - 60 * dayInMilliseconds;
    const endDate = Date.now() - 14 * dayInMilliseconds;
    const duration = endDate - startDate;
    
    for (let i = 0; i < 150; i++) {
      sequence += 1;
      const progress = i / 150; // 0 to 1
      const loggedAt = new Date(startDate + progress * duration);
      
      const isWard1 = Math.random() > 0.5;
      let status;
      let household;
      let reason = null;
      let note = null;
      
      if (isWard1) {
        household = ward1[Math.floor(Math.random() * ward1.length)];
        // Improving trend: 45% -> 75%
        const probSegregated = 0.45 + (0.30 * progress);
        status = Math.random() < probSegregated ? 'segregated' : (Math.random() < 0.6 ? 'mixed' : 'rejected');
      } else {
        // Repeat offenders in Ward 2 (indices 0 and 1)
        const isRepeatOffender = Math.random() < 0.4;
        household = isRepeatOffender 
          ? ward2[Math.floor(Math.random() * 2)] 
          : ward2[Math.floor(Math.random() * ward2.length)];
          
        const r = Math.random();
        if (isRepeatOffender) {
          status = r < 0.2 ? 'segregated' : (r < 0.7 ? 'mixed' : 'rejected');
        } else {
          status = r < 0.4 ? 'segregated' : (r < 0.8 ? 'mixed' : 'rejected');
        }
      }
      
      if (status === 'rejected') reason = rejectionReasons[sequence % rejectionReasons.length];
      if (status === 'mixed') note = 'Please separate wet and dry waste for the next collection.';
      
      events.push({
        clientUuid: makeClientUuid(sequence),
        household,
        status,
        reason,
        note,
        loggedAt,
      });
    }
  }

  for (const plan of statusPlans) {
    const wardHouseholds = householdDefinitions
      .filter((household) => household.wardCode === plan.wardCode)
      .map((household, index) => householdByQrCode.get(`HH-${plan.wardCode}-${String(index + 1).padStart(3, '0')}`));

    plan.statuses.forEach((status, dayIndex) => {
      sequence += 1;
      const loggedAt = new Date(Date.now() - (13 - dayIndex) * dayInMilliseconds - 15 * 60 * 1000);
      events.push({
        clientUuid: makeClientUuid(sequence),
        household: wardHouseholds[dayIndex % wardHouseholds.length],
        status,
        reason: status === 'rejected' ? rejectionReasons[(sequence - 1) % rejectionReasons.length] : null,
        note: status === 'mixed' ? 'Please separate wet and dry waste for the next collection.' : null,
        loggedAt,
      });
    });
  }

  return events.sort((first, second) => first.loggedAt - second.loggedAt);
}

async function findOrCreateDemoData(transaction) {
  const wards = new Map();
  for (const definition of wardDefinitions) {
    const [ward] = await Ward.findOrCreate({
      where: { code: definition.code },
      defaults: definition,
      transaction,
    });
    wards.set(ward.code, ward);
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const userDefinitions = [
    { name: 'Demo Sanitation Worker', email: 'worker@demo.in', role: 'worker', wardId: wards.get('W01').id, phone: '9876500001' },
    { name: 'Demo Ward Supervisor', email: 'supervisor@demo.in', role: 'supervisor', wardId: wards.get('W01').id, phone: '9876500002' },
    { name: 'Demo ULB Administrator', email: 'admin@demo.in', role: 'ulb_admin', wardId: null, phone: '9876500003' },
  ];

  const users = new Map();
  for (const definition of userDefinitions) {
    const [user] = await User.findOrCreate({
      where: { email: definition.email },
      defaults: { ...definition, passwordHash },
      transaction,
    });
    users.set(user.email, user);
  }

  const householdByQrCode = new Map();
  let wardSequence = new Map();
  for (const definition of householdDefinitions) {
    const sequence = (wardSequence.get(definition.wardCode) || 0) + 1;
    wardSequence.set(definition.wardCode, sequence);
    const qrCode = `HH-${definition.wardCode}-${String(sequence).padStart(3, '0')}`;
    const [household] = await Household.findOrCreate({
      where: { qrCode },
      defaults: {
        qrCode,
        ownerName: definition.ownerName,
        phone: definition.phone,
        address: definition.address,
        type: definition.type,
        wardId: wards.get(definition.wardCode).id,
      },
      transaction,
    });
    householdByQrCode.set(qrCode, household);
  }

  return { householdByQrCode, users, wards };
}

async function seedPickups({ householdByQrCode, users }, transaction) {
  const worker = users.get('worker@demo.in');

  for (const event of buildPickupEvents(householdByQrCode)) {
    const [pickupLog, created] = await PickupLog.findOrCreate({
      where: { clientUuid: event.clientUuid },
      defaults: {
        householdId: event.household.id,
        workerId: worker.id,
        status: event.status,
        reason: event.reason,
        note: event.note,
        loggedAt: event.loggedAt,
      },
      transaction,
    });

    if (!created) continue;

    const previousLogs = await PickupLog.findAll({
      where: {
        householdId: event.household.id,
        loggedAt: { [Op.lt]: event.loggedAt },
      },
      attributes: ['status', 'loggedAt'],
      order: [['loggedAt', 'ASC']],
      transaction,
    });
    const household = await Household.findByPk(event.household.id, { transaction });
    const award = calculatePoints(previousLogs, event.status);
    const balanceAfter = household.ecoPoints + award.points;

    await household.update({ ecoPoints: balanceAfter }, { transaction });
    await PointsLedger.create({
      householdId: household.id,
      pickupLogId: pickupLog.id,
      points: award.points,
      reason: award.reason,
      balanceAfter,
    }, { transaction });

    const message = event.status === 'segregated'
      ? `Thank you for segregating your waste. You earned ${award.points} eco-points.`
      : event.status === 'rejected'
        ? `Today's pickup was rejected: ${event.reason}. Please correct this before the next collection.`
        : "Today's waste was collected as mixed. Please separate wet and dry waste before the next pickup.";

    await Notification.create({
      householdId: household.id,
      pickupLogId: pickupLog.id,
      channel: 'in_app',
      message,
    }, { transaction });
  }
}

async function printSummary(wards) {
  const models = [Ward, User, Household, PickupLog, Notification, PointsLedger];
  console.log('\nSeed complete. Row counts:');
  for (const model of models) {
    console.log(`  ${model.name}: ${await model.count()}`);
  }

  console.log('\nCompliance by ward:');
  for (const ward of wards.values()) {
    const households = await Household.findAll({ where: { wardId: ward.id }, attributes: ['id'] });
    const logs = await PickupLog.findAll({
      where: { householdId: { [Op.in]: households.map((household) => household.id) } },
      attributes: ['status'],
    });
    const compliance = calculateCompliance(logs);
    console.log(`  ${ward.name} (${ward.code}): ${compliance.compliancePercent}% (${compliance.segregated}/${compliance.total})`);
  }
}

try {
  await sequelize.sync({ force: reset });
  const transaction = await sequelize.transaction();
  let seededData;
  try {
    seededData = await findOrCreateDemoData(transaction);
    await seedPickups(seededData, transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  await printSummary(seededData.wards);

  if (reset) {
    console.log('\n=========================================');
    console.log('DEMO-ONLY CREDENTIALS (for testing)');
    console.log('=========================================');
    console.log('Worker Login:');
    console.log('  Email:    worker@demo.in');
    console.log('  Password: Demo@1234');
    console.log('\nCitizen Codes (Code + Last 4 of phone):');
    const sampleHouseholds = Array.from(seededData.householdByQrCode.values()).slice(0, 3);
    for (const h of sampleHouseholds) {
      console.log(`  Code: ${h.qrCode.padEnd(12)} Last 4: ${h.phone.slice(-4)}  (${h.ownerName})`);
    }
    console.log('=========================================\n');
  }
} catch (error) {
  console.error('Database seeding failed:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}