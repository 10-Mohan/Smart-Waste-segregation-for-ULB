import { Op, col, fn, literal } from 'sequelize';
import { Household, PickupLog, sequelize, User, Ward } from '../models/index.js';
import { calculateComplianceFromCounts } from './complianceService.js';

const DAY = 24 * 60 * 60 * 1000;

export function resolvePeriod(from, to, now = new Date()) {
  const end = to ? new Date(to) : new Date(now);
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * DAY);
  const duration = end.getTime() - start.getTime();
  return {
    from: start,
    to: end,
    previousFrom: new Date(start.getTime() - duration),
    previousTo: new Date(start.getTime() - 1),
  };
}

function makeLogWhere(from, to, extra = {}) {
  return {
    ...extra,
    loggedAt: { [Op.gte]: from, [Op.lte]: to },
  };
}

async function groupedStatusCounts({ from, to, wardId, householdId }) {
  const include = [];
  if (wardId) {
    include.push({
      model: Household,
      as: 'household',
      attributes: [],
      where: { wardId },
      required: true,
    });
  }
  const where = makeLogWhere(from, to, householdId ? { householdId } : {});
  const rows = await PickupLog.findAll({
    attributes: ['status', [fn('COUNT', col('PickupLog.id')), 'count']],
    where,
    include,
    group: ['status'],
    raw: true,
  });
  const counts = { segregated: 0, mixed: 0, rejected: 0 };
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}

function summarizeCounts(counts) {
  const compliance = calculateComplianceFromCounts(counts);
  return { ...counts, totalPickups: compliance.total, compliancePercent: compliance.compliancePercent };
}

export async function getSummary({ from, to, wardId }) {
  const period = resolvePeriod(from, to);
  const [currentCounts, previousCounts, totalHouseholds, activeHouseholds] = await Promise.all([
    groupedStatusCounts({ ...period, wardId }),
    groupedStatusCounts({ from: period.previousFrom, to: period.previousTo, wardId }),
    Household.count({ where: wardId ? { wardId } : {} }),
    Household.count({ where: { ...(wardId ? { wardId } : {}), active: true } }),
  ]);
  const current = summarizeCounts(currentCounts);
  const previous = summarizeCounts(previousCounts);

  return {
    from: period.from,
    to: period.to,
    totalHouseholds,
    activeHouseholds,
    totalPickups: current.totalPickups,
    segregated: current.segregated,
    mixed: current.mixed,
    rejected: current.rejected,
    compliancePercent: current.compliancePercent,
    changeVsPreviousPeriod: {
      totalPickups: current.totalPickups - previous.totalPickups,
      compliancePercent: Math.round((current.compliancePercent - previous.compliancePercent) * 10) / 10,
    },
  };
}

export async function getWardSummaries({ from, to, wardId }) {
  const period = resolvePeriod(from, to);
  const wards = await Ward.findAll({
    where: wardId ? { id: wardId } : {},
    order: [['code', 'ASC']],
  });
  return Promise.all(wards.map(async (ward) => {
    const [households, counts] = await Promise.all([
      Household.count({ where: { wardId: ward.id } }),
      groupedStatusCounts({ ...period, wardId: ward.id }),
    ]);
    const result = summarizeCounts(counts);
    const level = result.compliancePercent >= 70 ? 'good' : result.compliancePercent >= 40 ? 'moderate' : 'poor';
    return {
      wardId: ward.id,
      wardCode: ward.code,
      wardName: ward.name,
      households,
      pickups: result.totalPickups,
      segregated: result.segregated,
      mixed: result.mixed,
      rejected: result.rejected,
      compliancePercent: result.compliancePercent,
      level,
    };
  }));
}

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function weekStart(date) {
  const start = utcDay(date);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function periodDateKey(value) {
  return value instanceof Date ? dayKey(utcDay(value)) : String(value).slice(0, 10);
}

export async function getTrends({ from, to, wardId, granularity = 'day' }) {
  const period = resolvePeriod(from, to);
  const include = wardId ? [{ model: Household, as: 'household', attributes: [], where: { wardId }, required: true }] : [];
  const periodExpression = sequelize.getDialect() === 'postgres'
    ? fn('date_trunc', 'day', col('PickupLog.loggedAt'))
    : fn('date', col('PickupLog.loggedAt'));
  const dailyRows = await PickupLog.findAll({
    attributes: [[periodExpression, 'period'], 'status', [fn('COUNT', col('PickupLog.id')), 'count']],
    where: makeLogWhere(period.from, period.to),
    include,
    group: [literal('period'), 'status'],
    order: [[literal('period'), 'ASC']],
    raw: true,
  });

  const countsByPeriod = new Map();
  for (const row of dailyRows) {
    const dateKeyValue = periodDateKey(row.period);
    const date = new Date(`${dateKeyValue}T00:00:00.000Z`);
    const key = granularity === 'week' ? dayKey(weekStart(date)) : dateKeyValue;
    const counts = countsByPeriod.get(key) || { segregated: 0, mixed: 0, rejected: 0 };
    counts[row.status] = Number(row.count);
    countsByPeriod.set(key, counts);
  }

  const result = [];
  const start = granularity === 'week' ? weekStart(period.from) : utcDay(period.from);
  const end = granularity === 'week' ? weekStart(period.to) : utcDay(period.to);
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + (granularity === 'week' ? 7 : 1) * DAY)) {
    const key = dayKey(cursor);
    const summarized = summarizeCounts(countsByPeriod.get(key) || { segregated: 0, mixed: 0, rejected: 0 });
    result.push({ period: key, ...summarized });
  }
  return { granularity, from: period.from, to: period.to, data: result };
}

export async function getHotspots({ from, to, wardId }) {
  const period = resolvePeriod(from, to);
  const include = [{
    model: Household,
    as: 'household',
    attributes: [],
    ...(wardId ? { where: { wardId } } : {}),
    required: Boolean(wardId),
  }];
  const aggregates = await PickupLog.findAll({
    attributes: ['householdId', [fn('COUNT', col('PickupLog.id')), 'violationCount']],
    where: makeLogWhere(period.from, period.to, { status: { [Op.in]: ['mixed', 'rejected'] } }),
    include,
    group: ['PickupLog.householdId'],
    order: [[literal('violationCount'), 'DESC']],
    limit: 10,
    raw: true,
  });
  const ids = aggregates.map((row) => Number(row.householdId));
  if (!ids.length) return [];

  const [households, reasonRows] = await Promise.all([
    Household.findAll({ where: { id: { [Op.in]: ids } }, include: [{ model: Ward, as: 'ward' }] }),
    PickupLog.findAll({
      attributes: ['householdId', 'reason', [fn('COUNT', col('PickupLog.id')), 'reasonCount']],
      where: makeLogWhere(period.from, period.to, {
        householdId: { [Op.in]: ids },
        status: 'rejected',
      }),
      group: ['householdId', 'reason'],
      order: [[literal('reasonCount'), 'DESC'], ['reason', 'ASC']],
      raw: true,
    }),
  ]);
  const householdById = new Map(households.map((household) => [household.id, household]));
  const commonReasonById = new Map();
  for (const row of reasonRows) {
    if (!commonReasonById.has(Number(row.householdId))) commonReasonById.set(Number(row.householdId), row.reason);
  }

  return aggregates.map((row) => {
    const household = householdById.get(Number(row.householdId));
    return {
      householdId: household.id,
      householdCode: household.qrCode,
      ownerName: household.ownerName,
      wardCode: household.ward.code,
      wardName: household.ward.name,
      address: household.address,
      count: Number(row.violationCount),
      mostCommonReason: commonReasonById.get(household.id) || 'Unspecified',
    };
  });
}

export async function getViolations({ from, to, wardId, page = 1, limit = 20 }) {
  const period = resolvePeriod(from, to);
  const { count, rows } = await PickupLog.findAndCountAll({
    where: makeLogWhere(period.from, period.to, { status: { [Op.in]: ['mixed', 'rejected'] } }),
    include: [
      {
        model: Household,
        as: 'household',
        where: wardId ? { wardId } : undefined,
        required: Boolean(wardId),
        include: [{ model: Ward, as: 'ward' }],
      },
      { model: User, as: 'worker', attributes: ['id', 'name'] },
    ],
    order: [['loggedAt', 'DESC']],
    limit: Number(limit),
    offset: (Number(page) - 1) * Number(limit),
    distinct: true,
  });
  return { rows, count, page: Number(page), limit: Number(limit) };
}

export async function getRejectionReasons({ from, to, wardId }) {
  const period = resolvePeriod(from, to);
  const include = wardId ? [{ model: Household, as: 'household', attributes: [], where: { wardId }, required: true }] : [];
  return PickupLog.findAll({
    attributes: ['reason', [fn('COUNT', col('PickupLog.id')), 'count']],
    where: makeLogWhere(period.from, period.to, { status: 'rejected' }),
    include,
    group: ['reason'],
    order: [[literal('count'), 'DESC'], ['reason', 'ASC']],
    raw: true,
  }).then((rows) => rows.map((row) => ({ reason: row.reason || 'Unspecified', count: Number(row.count) })));
}

export async function getWardExportRows({ from, to, wardId }) {
  const summaries = await getWardSummaries({ from, to, wardId });
  const period = resolvePeriod(from, to);
  return Promise.all(summaries.map(async (summary) => {
    const householdIds = await Household.findAll({
      where: { wardId: summary.wardId },
      attributes: ['id'],
      raw: true,
    });
    const coveredHouseholds = await PickupLog.count({
      where: makeLogWhere(period.from, period.to, { householdId: { [Op.in]: householdIds.map((row) => row.id) } }),
      distinct: true,
      col: 'householdId',
    });
    return {
      ...summary,
      periodFrom: period.from,
      periodTo: period.to,
      coveredHouseholds,
    };
  }));
}