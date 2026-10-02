import api from './api.js';
import { cacheHouseholds, getCachedHousehold, getCachedHouseholds } from './offlineQueue.js';

function workerHousehold(household) {
  return {
    id: household.id,
    qrCode: household.qrCode,
    ownerName: household.ownerName,
    phone: household.phone,
    address: household.address,
    type: household.type,
    wardId: household.wardId,
    active: household.active,
    ward: household.ward ? { id: household.ward.id, name: household.ward.name, code: household.ward.code } : undefined,
    pickupLogs: household.pickupLogs?.map((log) => ({
      id: log.id,
      status: log.status,
      reason: log.reason,
      note: log.note,
      loggedAt: log.loggedAt,
    })),
  };
}

export async function downloadHouseholds(wardId) {
  const households = [];
  let page = 1;
  let total = Infinity;

  while (households.length < total) {
    const { data } = await api.get('/households', { params: { page, limit: 100 } });
    const pageRows = data.households || [];
    households.push(...pageRows
      .filter((household) => !wardId || household.wardId === wardId)
      .map(workerHousehold));
    total = Number(data.pagination?.total ?? households.length);
    if (pageRows.length < 100) break;
    page += 1;
  }

  await cacheHouseholds(households);
  return households;
}

export async function listCachedHouseholds(wardId) {
  const cached = await getCachedHouseholds();
  return cached.filter((household) => !wardId || household.wardId === wardId);
}

export async function lookupHousehold(qrCode) {
  const normalizedCode = String(qrCode || '').trim().toUpperCase();
  try {
    const { data } = await api.get(`/households/by-qr/${encodeURIComponent(normalizedCode)}`);
    const household = workerHousehold(data.household);
    await cacheHouseholds([household]);
    return { household, source: 'api' };
  } catch (error) {
    if (error.response?.status === 403) return { error: 'This household is outside your assigned ward.' };
    if (error.response?.status === 404) {
      return { household: await getCachedHousehold(normalizedCode), source: 'cache' };
    }
    if (error.response && error.response.status < 500) {
      return { error: 'Could not verify this household. Check the code and try again.' };
    }
    const household = await getCachedHousehold(normalizedCode);
    return household ? { household, source: 'cache', offline: true } : { household: null, source: 'cache', offline: true };
  }
}

export async function getPrintablePayload(household) {
  const { data } = await api.get(`/households/${household.id}/qr`);
  return data.payload;
}