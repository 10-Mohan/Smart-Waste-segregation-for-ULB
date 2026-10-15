import api from './api.js';

export async function fetchDashboardSummary(filters, options) {
  const { data } = await api.get('/dashboard/summary', { params: filters, ...options });
  return data;
}

export async function fetchDashboardWards(filters, options) {
  const { data } = await api.get('/dashboard/wards', { params: filters, ...options });
  return data.wards;
}

export async function fetchDashboardTrends(filters, options) {
  const { data } = await api.get('/dashboard/trends', { params: filters, ...options });
  return data;
}

export async function fetchDashboardHotspots(filters, options) {
  const { data } = await api.get('/dashboard/hotspots', { params: filters, ...options });
  return data.hotspots;
}

export async function fetchDashboardViolations(filters, options) {
  const { data } = await api.get('/dashboard/violations', { params: filters, ...options });
  return data;
}

export async function fetchDashboardReasons(filters, options) {
  const { data } = await api.get('/dashboard/reasons', { params: filters, ...options });
  return data.reasons;
}

export async function exportDashboardCsv(filters, token) {
  const searchParams = new URLSearchParams();
  if (filters.from) searchParams.set('from', filters.from);
  if (filters.to) searchParams.set('to', filters.to);
  if (filters.wardId) searchParams.set('wardId', filters.wardId);
  
  const response = await fetch(`${api.defaults.baseURL}/dashboard/export.csv?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to export CSV');
  }

  const disposition = response.headers.get('content-disposition');
  let filename = `dashboard-export-${new Date().toISOString().slice(0,10)}.csv`;
  if (disposition && disposition.includes('filename=')) {
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch.length === 2) {
      filename = filenameMatch[1];
    }
  }

  const blob = await response.blob();
  return { blob, filename };
}
