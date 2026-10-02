export function calculateComplianceFromCounts({ segregated = 0, mixed = 0, rejected = 0 }) {
  const total = segregated + mixed + rejected;
  const compliancePercent = total === 0
    ? 0
    : Math.round((segregated / total) * 1000) / 10;

  return { total, segregated, mixed, rejected, compliancePercent };
}

export function calculateCompliance(logs) {
  return calculateComplianceFromCounts({
    segregated: logs.filter((log) => log.status === 'segregated').length,
    mixed: logs.filter((log) => log.status === 'mixed').length,
    rejected: logs.filter((log) => log.status === 'rejected').length,
  });
}