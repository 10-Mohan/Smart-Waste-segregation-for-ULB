import { Op, col, fn } from 'sequelize';
import { Household, PointsLedger } from '../models/index.js';
import HttpError from '../utils/HttpError.js';

export const TIERS = [
  { name: 'Sprout', min: 0, perk: 'Welcome aboard - every segregated pickup earns you points.' },
  { name: 'Bronze', min: 50, perk: 'Digital appreciation certificate.' },
  { name: 'Silver', min: 150, perk: 'Certificate plus first choice of pickup time slot.' },
  { name: 'Gold', min: 300, perk: 'Certificate, priority slot and a ward shout-out as a Segregation Champion.' },
];

function tierInfo(points) {
  let currentIndex = 0;
  TIERS.forEach((tier, index) => { if (points >= tier.min) currentIndex = index; });
  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1] || null;
  return {
    current: { name: current.name, perk: current.perk },
    next: next ? { name: next.name, min: next.min, perk: next.perk } : null,
    pointsToNext: next ? next.min - points : 0,
    totalPoints: points,
    tiers: TIERS.map((tier) => ({ name: tier.name, min: tier.min, perk: tier.perk })),
  };
}

function displayName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Neighbour';
  const last = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : '';
  return `${parts[0]}${last}`;
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getLeaderboard({ qrCode, phoneLast4 }) {
  const household = await Household.findOne({ where: { qrCode } });
  if (!household || household.phone.slice(-4) !== phoneLast4) {
    throw new HttpError(404, 'Household was not found for the supplied details.');
  }

  const wardHouseholds = await Household.findAll({
    where: { wardId: household.wardId, active: true },
    attributes: ['id', 'ownerName'],
  });
  const ids = wardHouseholds.map((item) => item.id);
  const start = monthStart();
  const sums = ids.length
    ? await PointsLedger.findAll({
      attributes: ['householdId', [fn('SUM', col('points')), 'monthPoints']],
      where: { householdId: ids, createdAt: { [Op.gte]: start } },
      group: ['householdId'],
      raw: true,
    })
    : [];
  const pointsById = new Map(sums.map((row) => [row.householdId, Math.max(0, Number(row.monthPoints) || 0)]));

  const rows = wardHouseholds.map((item) => ({
    id: item.id,
    name: displayName(item.ownerName),
    monthPoints: pointsById.get(item.id) || 0,
  }));
  rows.sort((a, b) => b.monthPoints - a.monthPoints || a.name.localeCompare(b.name));
  const rankOf = (points) => rows.filter((row) => row.monthPoints > points).length + 1;

  const top = rows
    .filter((row) => row.monthPoints > 0)
    .slice(0, 10)
    .map((row) => ({
      rank: rankOf(row.monthPoints),
      name: row.name,
      monthPoints: row.monthPoints,
      isYou: row.id === household.id,
    }));

  const mine = pointsById.get(household.id) || 0;
  return {
    month: start.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    top,
    you: {
      monthPoints: mine,
      rank: rankOf(mine),
      outOf: rows.length,
      inTop: top.some((row) => row.isYou),
    },
    tier: tierInfo(household.ecoPoints),
  };
}