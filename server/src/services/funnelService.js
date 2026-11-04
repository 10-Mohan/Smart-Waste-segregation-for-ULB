import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SILVER_POINTS = 150; // keep in step with the Silver tier threshold

const ratedPickup = `EXISTS (
  SELECT 1 FROM "PickupRatings" r
  JOIN "PickupLogs" l ON l."id" = r."pickupLogId"
  WHERE l."householdId" = h."id"
)`;

function share(count, base) {
  return base ? Math.round((count / base) * 1000) / 10 : 0;
}

export async function getEngagementFunnel({ wardId } = {}) {
  const wardFilter = wardId ? 'AND h."wardId" = :wardId' : '';
  const [row] = await sequelize.query(
    `SELECT
       COUNT(*) AS registered,
       SUM(CASE WHEN h."email" IS NOT NULL THEN 1 ELSE 0 END) AS linked,
       SUM(CASE WHEN h."email" IS NOT NULL AND ${ratedPickup} THEN 1 ELSE 0 END) AS rated,
       SUM(CASE WHEN h."email" IS NOT NULL AND h."ecoPoints" >= :silver AND ${ratedPickup} THEN 1 ELSE 0 END) AS silver
     FROM "Households" h
     WHERE h."active" = :active ${wardFilter}`,
    { replacements: { active: true, silver: SILVER_POINTS, wardId: wardId || null }, type: QueryTypes.SELECT },
  );

  const counts = [
    { id: 'registered', label: 'Registered', count: Number(row?.registered) || 0 },
    { id: 'linked', label: 'Email linked', count: Number(row?.linked) || 0 },
    { id: 'rated', label: 'Rated a pickup', count: Number(row?.rated) || 0 },
    { id: 'silver', label: 'Silver tier or above', count: Number(row?.silver) || 0 },
  ];
  const total = counts[0].count;
  return {
    asOf: new Date().toISOString(),
    stages: counts.map((stage, index) => ({
      ...stage,
      percentOfTotal: share(stage.count, total),
      percentOfPrevious: index === 0 ? 100 : share(stage.count, counts[index - 1].count),
    })),
  };
}