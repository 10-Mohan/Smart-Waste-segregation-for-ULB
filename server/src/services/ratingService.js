import { Op, UniqueConstraintError, col, fn } from 'sequelize';
import { Household, PickupLog, PickupRating, User } from '../models/index.js';
import HttpError from '../utils/HttpError.js';

export const RATING_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Your collector';
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

async function averagesForWorkers(workerIds) {
  if (!workerIds.length) return new Map();
  const rows = await PickupRating.findAll({
    attributes: ['workerId', [fn('AVG', col('stars')), 'average'], [fn('COUNT', col('id')), 'count']],
    where: { workerId: workerIds },
    group: ['workerId'],
    raw: true,
  });
  return new Map(rows.map((row) => [row.workerId, { average: roundOne(Number(row.average)), count: Number(row.count) }]));
}

// Extra per-pickup fields for the citizen dashboard: who collected, their average, and rating state.
export async function getCitizenRatingContext(logs) {
  const context = new Map();
  if (!logs.length) return context;
  const workerIds = [...new Set(logs.map((log) => log.workerId).filter(Boolean))];
  const [workers, averages, ratings] = await Promise.all([
    workerIds.length ? User.findAll({ where: { id: workerIds }, attributes: ['id', 'name'] }) : [],
    averagesForWorkers(workerIds),
    PickupRating.findAll({ where: { pickupLogId: logs.map((log) => log.id) }, attributes: ['pickupLogId', 'stars', 'comment'] }),
  ]);
  const nameById = new Map(workers.map((worker) => [worker.id, firstName(worker.name)]));
  const ratingByLog = new Map(ratings.map((item) => [item.pickupLogId, { stars: item.stars, comment: item.comment }]));
  const now = Date.now();
  for (const log of logs) {
    const rating = ratingByLog.get(log.id) || null;
    const stats = averages.get(log.workerId);
    context.set(log.id, {
      workerFirstName: nameById.get(log.workerId) || null,
      workerAverage: stats?.average ?? null,
      workerRatingCount: stats?.count ?? 0,
      rating,
      canRate: log.status !== 'not_available'
        && !rating
        && now - new Date(log.loggedAt).getTime() <= RATING_WINDOW_DAYS * DAY_MS,
    });
  }
  return context;
}

export async function submitRating({ qrCode, phoneLast4, pickupLogId, stars, comment }) {
  const household = await Household.findOne({ where: { qrCode } });
  if (!household || household.phone.slice(-4) !== phoneLast4) {
    throw new HttpError(404, 'Household was not found for the supplied details.');
  }
  const log = await PickupLog.findOne({ where: { id: pickupLogId, householdId: household.id } });
  if (!log) throw new HttpError(404, 'Pickup was not found for this household.');
  if (log.status === 'not_available') {
    throw new HttpError(409, 'Nobody was home for this visit, so it cannot be rated.');
  }
  if (Date.now() - new Date(log.loggedAt).getTime() > RATING_WINDOW_DAYS * DAY_MS) {
    throw new HttpError(409, `Pickups can only be rated within ${RATING_WINDOW_DAYS} days.`);
  }
  try {
    const created = await PickupRating.create({
      pickupLogId: log.id,
      householdId: household.id,
      workerId: log.workerId,
      stars,
      comment: comment?.trim() || null,
    });
    return { stars: created.stars, comment: created.comment };
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new HttpError(409, 'You have already rated this pickup.');
    throw error;
  }
}

// A worker's own average and recent comments. Never includes household names.
export async function workerOwnSummary(workerId) {
  const averages = await averagesForWorkers([workerId]);
  const stats = averages.get(workerId) || { average: null, count: 0 };
  const recent = await PickupRating.findAll({
    where: { workerId, comment: { [Op.ne]: null } },
    attributes: ['stars', 'comment', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });
  return {
    average: stats.average,
    count: stats.count,
    recentComments: recent.map((item) => ({ stars: item.stars, comment: item.comment, date: item.createdAt })),
  };
}

// Supervisor scorecards: rating, workload this week and no-one-home rate per worker.
export async function workerScorecards({ wardId }) {
  const where = { role: 'worker' };
  if (wardId) where.wardId = Number(wardId);
  const workers = await User.findAll({ where, attributes: ['id', 'name', 'wardId'], order: [['name', 'ASC']] });
  const ids = workers.map((worker) => worker.id);
  if (!ids.length) return [];

  const weekStart = new Date(Date.now() - 7 * DAY_MS);
  const [averages, weekRows, reviews] = await Promise.all([
    averagesForWorkers(ids),
    PickupLog.findAll({
      attributes: ['workerId', 'status', [fn('COUNT', col('id')), 'count']],
      where: { workerId: ids, loggedAt: { [Op.gte]: weekStart } },
      group: ['workerId', 'status'],
      raw: true,
    }),
    PickupRating.findAll({
      where: { workerId: ids, comment: { [Op.ne]: null } },
      attributes: ['workerId', 'stars', 'comment', 'createdAt'],
      include: [{
        model: PickupLog,
        as: 'pickupLog',
        attributes: ['id'],
        include: [{ model: Household, as: 'household', attributes: ['ownerName'] }],
      }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    }),
  ]);

  const weekByWorker = new Map();
  for (const row of weekRows) {
    const entry = weekByWorker.get(row.workerId) || { total: 0, noOneHome: 0 };
    entry.total += Number(row.count);
    if (row.status === 'not_available') entry.noOneHome += Number(row.count);
    weekByWorker.set(row.workerId, entry);
  }

  return workers.map((worker) => {
    const stats = averages.get(worker.id);
    const week = weekByWorker.get(worker.id) || { total: 0, noOneHome: 0 };
    return {
      workerId: worker.id,
      name: worker.name,
      wardId: worker.wardId,
      averageRating: stats?.average ?? null,
      ratingsCount: stats?.count ?? 0,
      visitsThisWeek: week.total,
      noOneHomeThisWeek: week.noOneHome,
      noOneHomeRate: week.total ? Math.round((week.noOneHome / week.total) * 100) : 0,
      recentReviews: reviews
        .filter((item) => item.workerId === worker.id)
        .slice(0, 3)
        .map((item) => ({
          stars: item.stars,
          comment: item.comment,
          date: item.createdAt,
          household: item.pickupLog?.household?.ownerName || null,
        })),
    };
  });
}