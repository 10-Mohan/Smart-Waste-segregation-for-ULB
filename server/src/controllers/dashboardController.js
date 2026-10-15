import {
  getHotspots,
  getRejectionReasons,
  getSummary,
  getTrends,
  getViolations,
  getWardExportRows,
  getWardSummaries,
} from '../services/dashboardService.js';
import { scopedWardId } from '../utils/access.js';

function dashboardFilters(request) {
  return {
    from: request.query.from,
    to: request.query.to,
    wardId: scopedWardId(request.user, request.query.wardId),
  };
}

export async function summary(request, response) {
  response.json(await getSummary(dashboardFilters(request)));
}

export async function wards(request, response) {
  response.json({ wards: await getWardSummaries(dashboardFilters(request)) });
}

export async function trends(request, response) {
  response.json(await getTrends({ ...dashboardFilters(request), granularity: request.query.granularity || 'day' }));
}

export async function hotspots(request, response) {
  response.json({ hotspots: await getHotspots(dashboardFilters(request)) });
}

export async function violations(request, response) {
  const result = await getViolations({
    ...dashboardFilters(request),
    page: request.query.page || 1,
    limit: request.query.limit || 20,
  });
  response.json({
    violations: result.rows,
    pagination: { page: result.page, limit: result.limit, total: result.count },
  });
}

export async function reasons(request, response) {
  response.json({ reasons: await getRejectionReasons(dashboardFilters(request)) });
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function exportCsv(request, response) {
  const rows = await getWardExportRows(dashboardFilters(request));
  const headers = [
    'Period From', 'Period To', 'Ward Code', 'Ward Name', 'Households Covered',
    'Pickups Logged', 'Segregated', 'Mixed', 'Rejected', 'Compliance %',
  ];
  // SBM-style export columns are provided for convenience; the official template may differ.
  const lines = [headers, ...rows.map((row) => [
    new Date(row.periodFrom).toISOString().slice(0, 10),
    new Date(row.periodTo).toISOString().slice(0, 10),
    row.wardCode,
    row.wardName,
    row.coveredHouseholds,
    row.pickups,
    row.segregated,
    row.mixed,
    row.rejected,
    row.compliancePercent,
  ])].map((line) => line.map(csvCell).join(','));
  const filename = `sbm-style-waste-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.send(`${lines.join('\r\n')}\r\n`);
}