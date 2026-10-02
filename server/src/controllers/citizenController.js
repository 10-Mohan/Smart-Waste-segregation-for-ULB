import { Op, col, fn } from 'sequelize';
import { Household, Notification, PickupLog, PointsLedger, Ward } from '../models/index.js';
import { calculateComplianceFromCounts } from '../services/complianceService.js';
import { CONSECUTIVE_SEGREGATED_BONUS_INTERVAL } from '../services/pointsService.js';
import { normalizeAddress, withHouseholdQrAllocation } from '../services/householdService.js';
import HttpError from '../utils/HttpError.js';

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
  const household = await withHouseholdQrAllocation(wardId, async ({ ward, qrCode, transaction }) => {
    const samePhone = await Household.findAll({
      where: { wardId: ward.id, phone },
      attributes: ['address'],
      transaction,
    });
    if (samePhone.some((item) => normalizeAddress(item.address) === normalizeAddress(address))) {
      throw new HttpError(409, 'This household may already be registered. Use your existing code, or ask your collection worker.');
    }

    return Household.create({ ownerName, phone, address: address.trim(), type, wardId: ward.id, qrCode }, { transaction });
  });
  const ward = await Ward.findByPk(wardId, { attributes: ['name'] });
  response.status(201).json({
    qrCode: household.qrCode,
    ownerFirstName: household.ownerName.trim().split(/\s+/)[0],
    wardName: ward.name,
    type: household.type,
    phoneLast4: household.phone.slice(-4),
  });
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
        attributes: ['id', 'status', 'reason', 'loggedAt'],
      },
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
  for (const { status, count } of weeklyGroups) weeklyCounts[status] = Number(count);
  const weeklyCompliance = calculateComplianceFromCounts(weeklyCounts);
  const lastThree = household.pickupLogs.slice(0, 3);
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

  response.json({
    household: { name: household.ownerName.split(/\s+/)[0] },
    wardName: household.ward.name,
    ecoPoints: household.ecoPoints,
    currentStatus,
    logs: household.pickupLogs.map((log) => ({ id: log.id, date: log.loggedAt, status: log.status, reason: log.reason })),
    notifications: household.notifications,
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
  });
}