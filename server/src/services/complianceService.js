export function calculateComplianceFromCounts({ segregated = 0, mixed = 0, rejected = 0, not_available = 0 }) {
  // 'not_available' (nobody home) is reported separately and never counts for or against compliance.
  const total = segregated + mixed + rejected;
  const compliancePercent = total === 0
    ? 0
    : Math.round((segregated / total) * 1000) / 10;

  return { total, segregated, mixed, rejected, missedNoOneHome: not_available, compliancePercent };
}

export function calculateCompliance(logs) {
  return calculateComplianceFromCounts({
    segregated: logs.filter((log) => log.status === 'segregated').length,
    mixed: logs.filter((log) => log.status === 'mixed').length,
    rejected: logs.filter((log) => log.status === 'rejected').length,
    not_available: logs.filter((log) => log.status === 'not_available').length,
  });
}