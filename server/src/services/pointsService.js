export const SEGREGATED_POINTS = 10;
export const MIXED_POINTS = 0;
export const REJECTED_POINTS = 0;
export const CONSECUTIVE_SEGREGATED_BONUS_POINTS = 5;
export const CONSECUTIVE_SEGREGATED_BONUS_INTERVAL = 3;

export const POINTS_RULES = Object.freeze({
  segregated: SEGREGATED_POINTS,
  mixed: MIXED_POINTS,
  rejected: REJECTED_POINTS,
  consecutiveSegregatedBonusPoints: CONSECUTIVE_SEGREGATED_BONUS_POINTS,
  consecutiveSegregatedBonusInterval: CONSECUTIVE_SEGREGATED_BONUS_INTERVAL,
});

function getChronologicalLogs(logs) {
  return [...logs].sort((first, second) => {
    const firstTime = new Date(first.loggedAt ?? first.createdAt ?? 0).getTime();
    const secondTime = new Date(second.loggedAt ?? second.createdAt ?? 0).getTime();
    return firstTime - secondTime;
  });
}

export function calculatePoints(previousLogsForHousehold, newStatus) {
  if (newStatus === 'mixed') {
    return { points: MIXED_POINTS, reason: 'Mixed waste: no points awarded.' };
  }

  if (newStatus === 'rejected') {
    return { points: REJECTED_POINTS, reason: 'Rejected pickup: no points awarded.' };
  }

  if (newStatus !== 'segregated') {
    throw new Error(`Unsupported pickup status: ${newStatus}`);
  }

  const chronologicalLogs = getChronologicalLogs(previousLogsForHousehold);
  let consecutiveCount = 1;

  for (let index = chronologicalLogs.length - 1; index >= 0; index -= 1) {
    if (chronologicalLogs[index].status !== 'segregated') break;
    consecutiveCount += 1;
  }

  const earnsBonus = consecutiveCount % CONSECUTIVE_SEGREGATED_BONUS_INTERVAL === 0;
  const points = SEGREGATED_POINTS + (earnsBonus ? CONSECUTIVE_SEGREGATED_BONUS_POINTS : 0);
  const reason = earnsBonus
    ? `Segregated pickup (${SEGREGATED_POINTS} points) and bonus for ${consecutiveCount} consecutive pickups (+${CONSECUTIVE_SEGREGATED_BONUS_POINTS}).`
    : 'Segregated pickup.';

  return { points, reason };
}