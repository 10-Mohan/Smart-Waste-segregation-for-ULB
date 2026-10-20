import { Op } from 'sequelize';
import { Household, PickupLog } from '../models/index.js';

const RETRY_WINDOW_HOURS = 48;

// Households whose most recent pickup log is 'not_available', logged within the last 48 hours.
export async function getRetryList({ wardId }) {
  const households = await Household.findAll({
    where: { wardId },
    attributes: ['id', 'ownerName', 'address', 'qrCode', 'awayUntil', 'preferredWindow'],
  });
  if (households.length === 0) return [];

  const cutoff = new Date(Date.now() - RETRY_WINDOW_HOURS * 60 * 60 * 1000);
  const logs = await PickupLog.findAll({
    where: { householdId: households.map((h) => h.id), loggedAt: { [Op.gte]: cutoff } },
    attributes: ['id', 'householdId', 'status', 'loggedAt'],
    order: [['loggedAt', 'DESC'], ['id', 'DESC']],
    raw: true,
  });

  const latestByHousehold = new Map();
  for (const log of logs) {
    if (!latestByHousehold.has(log.householdId)) latestByHousehold.set(log.householdId, log);
  }

  return households
    .filter((h) => latestByHousehold.get(h.id)?.status === 'not_available')
    .map((h) => ({
      householdId: h.id,
      ownerName: h.ownerName,
      address: h.address,
      qrCode: h.qrCode,
      loggedAt: latestByHousehold.get(h.id).loggedAt,
      awayUntil: h.awayUntil,
      preferredWindow: h.preferredWindow,
    }))
    .sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));
}