import { Op, col, fn } from 'sequelize';
import jwt from 'jsonwebtoken';
import { sequelize } from '../config/database.js';
import { Household, Notification, PickupLog, PointsLedger, Ward } from '../models/index.js';
import { calculateComplianceFromCounts } from '../services/complianceService.js';
import { CONSECUTIVE_SEGREGATED_BONUS_INTERVAL } from '../services/pointsService.js';
import { normalizeAddress, withHouseholdQrAllocation } from '../services/householdService.js';
import HttpError from '../utils/HttpError.js';
import { getCitizenRatingContext } from '../services/ratingService.js';
import { getJwtSecret } from '../middleware/auth.js';
import { issueCode, checkCode } from '../services/otpService.js';
import { sendEmailCode } from '../services/mailer.js';

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const tipsByStatus = {
  mixed: 'Keep wet and dry waste in separate, clearly marked bins. Rinse recyclable containers before collection.',
  rejected: 'Remove hazardous or sanitary waste from the dry bin and hand it over through the appropriate collection channel.',
};

export async function citizenWards(_request, response) {
  const wards = await Ward.findAll({ attributes: ['id', 'name', 'code'], order: [['code', 'ASC']] });
  response.json(wards);
}

export async function registerCitizenHousehold(request, response) {
  const { ownerName, phone, address, type, wardId } = request.body;
  const email = String(request.body.email || '').trim().toLowerCase();
  if (!email || !emailPattern.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  const existingEmail = await Household.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email),
  });
  if (existingEmail) {
    throw new HttpError(409, 'This email is already registered to another household.');
  }

  let household;
  try {
    household = await withHouseholdQrAllocation(wardId, async ({ ward, qrCode, transaction }) => {
      const samePhone = await Household.findAll({
        where: { wardId: ward.id, phone },
        attributes: ['address'],
        transaction,
      });
      if (samePhone.some((item) => normalizeAddress(item.address) === normalizeAddress(address))) {
        throw new HttpError(409, 'This household may already be registered. Use your existing code, or ask your collection worker.');
      }

      return Household.create({
        ownerName: ownerName.trim(),
        phone,
        email,
        address: address.trim(),
        type,
        wardId: ward.id,
        qrCode,
        active: false,
      }, { transaction });
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'This email is already registered to another household.');
    }
    throw err;
  }

  const code = await issueCode({ channel: 'email', identifier: email, purpose: 'household-register' });
  try {
    await sendEmailCode(email, code);
  } catch (mailError) {
    console.error('Registration email delivery failed:', mailError.message);
    throw new HttpError(502, 'Could not send verification code to your email. Please check your email address and try again.');
  }

  const ward = await Ward.findByPk(wardId, { attributes: ['name'] });
  response.status(201).json({
    message: 'A 6-digit verification code has been sent to your email.',
    qrCode: household.qrCode,
    email: household.email,
    ownerFirstName: household.ownerName.trim().split(/\s+/)[0],
    wardName: ward?.name || '',
    type: household.type,
    phoneLast4: household.phone.slice(-4),
    active: false,
  });
}

export async function verifyCitizenRegistration(request, response) {
  const email = String(request.body.email || '').trim().toLowerCase();
  if (!email || !emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const code = String(request.body.code || '').trim();
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.');

  await checkCode({ channel: 'email', identifier: email, purpose: 'household-register', code });

  const household = await Household.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email),
    include: [{ model: Ward, as: 'ward', attributes: ['name'] }],
  });
  if (!household) throw new HttpError(404, 'Household was not found.');

  await household.update({ active: true });

  const token = jwt.sign({ hid: household.id, typ: 'citizen' }, getJwtSecret(), { expiresIn: '7d' });
  response.json({
    message: 'Household registered and verified successfully.',
    token,
    household: {
      qrCode: household.qrCode,
      ownerFirstName: household.ownerName.trim().split(/\s+/)[0],
      wardName: household.ward?.name || '',
      type: household.type,
      phoneLast4: household.phone.slice(-4),
      email: household.email,
      active: true,
    },
  });
}

export async function resendCitizenRegistrationCode(request, response) {
  const email = String(request.body.email || '').trim().toLowerCase();
  if (!email || !emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email address.');

  const household = await Household.findOne({
    where: {
      [Op.and]: [
        sequelize.where(sequelize.fn('lower', sequelize.col('email')), email),
        { active: false },
      ],
    },
  });
  if (!household) throw new HttpError(404, 'No pending registration found for this email.');

  const code = await issueCode({ channel: 'email', identifier: email, purpose: 'household-register' });
  try {
    await sendEmailCode(email, code);
  } catch (mailError) {
    console.error('Registration email delivery failed:', mailError.message);
    throw new HttpError(502, 'Could not send verification code to your email.');
  }

  response.json({ message: 'A new 6-digit verification code has been sent to your email.' });
}

export async function citizenStatus(request, response) {
  const household = await Household.findOne({
    where: { qrCode: request.query.qrCode },
    include: [
      { model: Ward, as: 'ward', attributes: ['id', 'name', 'code'] },
      {
        model: PickupLog,
        as: 'pickupLogs',
        separate: true,
        limit: 10,
        order: [['loggedAt', 'DESC']],
        attributes: ['id', 'status', 'reason', 'loggedAt', 'workerId'],      },
      {
        model: Notification,
        as: 'notifications',
        separate: true,
        limit: 10,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'channel', 'message', 'status', 'createdAt'],
      },
    ],
  });

  if (!household || household.phone.slice(-4) !== request.query.phoneLast4) {
    throw new HttpError(404, 'Household was not found for the supplied details.');
  }

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentRejections = await PickupLog.count({
    where: { householdId: household.id, status: 'rejected', loggedAt: { [Op.gte]: weekStart } },
  });
  const weeklyGroups = await PickupLog.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    where: { householdId: household.id, loggedAt: { [Op.gte]: weekStart } },
    group: ['status'],
    raw: true,
  });
  const weeklyCounts = { segregated: 0, mixed: 0, rejected: 0 };
  for (const { status, count } of weeklyGroups) {
    if (status in weeklyCounts) weeklyCounts[status] = Number(count);
  }
  const weeklyCompliance = calculateComplianceFromCounts(weeklyCounts);
  const lastThree = household.pickupLogs.filter((log) => log.status !== 'not_available').slice(0, 3);
  const allLastThreeSegregated = lastThree.length === 3 && lastThree.every((log) => log.status === 'segregated');
  const currentStatus = allLastThreeSegregated || recentRejections === 0 ? 'green' : 'red';
  const latestNonCompliant = household.pickupLogs.find((log) => log.status === 'mixed' || log.status === 'rejected');
  const pointsHistory = await PointsLedger.findAll({
    where: { householdId: household.id },
    attributes: ['id', 'points', 'reason', 'balanceAfter', 'createdAt', 'pickupLogId'],
    include: [{ model: PickupLog, as: 'pickupLog', attributes: ['id', 'status'] }],
    order: [['createdAt', 'DESC']],
    limit: 10,
  });
  
  const ratingContext = await getCitizenRatingContext(household.pickupLogs);
  response.json({
    household: { name: household.ownerName.split(/\s+/)[0] },
    wardName: household.ward.name,
    ecoPoints: household.ecoPoints,
    currentStatus,
    logs: household.pickupLogs.map((log) => ({ id: log.id, date: log.loggedAt, status: log.status, reason: log.reason, ...(ratingContext.get(log.id) || {}) })),    notifications: household.notifications,
    weeklyComplianceScore: weeklyCompliance.total ? weeklyCompliance.compliancePercent : null,
    weeklyComplianceDetails: {
      total: weeklyCompliance.total,
      segregated: weeklyCompliance.segregated,
    },
    tips: latestNonCompliant ? tipsByStatus[latestNonCompliant.status] : null,
    pointsHistory: pointsHistory.map((entry) => ({
      date: entry.createdAt,
      points: entry.points,
      reason: entry.reason,
      balanceAfter: entry.balanceAfter,
      pickup: { id: entry.pickupLog?.id || entry.pickupLogId, status: entry.pickupLog?.status || null },
    })),
    pointsRules: { consecutiveSegregatedBonusInterval: CONSECUTIVE_SEGREGATED_BONUS_INTERVAL },
    awayUntil: household.awayUntil,
    preferredWindow: household.preferredWindow,
  });
}

export async function updateAvailability(request, response) {
  const { qrCode, phoneLast4, awayUntil, preferredWindow } = request.body;
  const household = await Household.findOne({ where: { qrCode } });
  if (!household || household.phone.slice(-4) !== phoneLast4) {
    throw new HttpError(404, 'Household was not found for the supplied details.');
  }
  await household.update({
    awayUntil: awayUntil || null,
    preferredWindow: preferredWindow || null,
  });
  response.json({ awayUntil: household.awayUntil, preferredWindow: household.preferredWindow });
}