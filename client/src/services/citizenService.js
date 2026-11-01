import api from './api.js';

export const CITIZEN_CODE_KEY = 'citizen-household-code';
export const CITIZEN_PHONE_LAST4_KEY = 'citizen-phone-last4';
export const CITIZEN_TOKEN_KEY = 'citizen-session-token';

export function getCitizenToken() {
  return sessionStorage.getItem(CITIZEN_TOKEN_KEY);
}

function citizenConfig(extra = {}) {
  const token = getCitizenToken();
  return { ...extra, citizen: true, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) };
}

export async function getCitizenWards() {
  const { data } = await api.get('/citizen/wards');
  return data;
}

export async function registerCitizenHousehold(details) {
  const { data } = await api.post('/citizen/register', details);
  return data;
}

export async function getCitizenStatus(qrCode, phoneLast4) {
  const { data } = await api.get('/citizen/status', citizenConfig({ params: { qrCode, phoneLast4 } }));
  return data;
}

export async function updateCitizenAvailability(qrCode, phoneLast4, { awayUntil, preferredWindow }) {
  const { data } = await api.post('/citizen/availability', {
    qrCode,
    phoneLast4,
    awayUntil: awayUntil || null,
    preferredWindow: preferredWindow || null,
  }, citizenConfig());
  return data;
}

export async function rateCitizenPickup(qrCode, phoneLast4, { pickupLogId, stars, comment }) {
  const { data } = await api.post('/ratings/citizen', {
    qrCode,
    phoneLast4,
    pickupLogId,
    stars,
    comment: comment || null,
  }, citizenConfig());
  return data;
}

export async function getCitizenLeaderboard(qrCode, phoneLast4) {
  const { data } = await api.get('/leaderboard', citizenConfig({ params: { qrCode, phoneLast4 } }));
  return data;
}

export async function requestCitizenCode(channel, identifier) {
  const { data } = await api.post('/citizen/auth/request', { channel, identifier }, { citizen: true });
  return data;
}

export async function verifyCitizenCode(channel, identifier, code) {
  const { data } = await api.post('/citizen/auth/verify', { channel, identifier, code }, { citizen: true });
  return data;
}

export async function requestLinkCode(qrCode, phoneLast4, email) {
  const { data } = await api.post('/citizen/auth/link/request', { qrCode, phoneLast4, email }, { citizen: true });
  return data;
}

export async function verifyLinkCode(qrCode, phoneLast4, email, code) {
  const { data } = await api.post('/citizen/auth/link/verify', { qrCode, phoneLast4, email, code }, { citizen: true });
  return data;
}

export function saveCitizenSession(qrCode, phoneLast4) {
  sessionStorage.removeItem(CITIZEN_TOKEN_KEY);
  sessionStorage.setItem(CITIZEN_CODE_KEY, qrCode);
  sessionStorage.setItem(CITIZEN_PHONE_LAST4_KEY, phoneLast4);
}

export function saveCitizenToken(token, qrCode) {
  sessionStorage.setItem(CITIZEN_TOKEN_KEY, token);
  sessionStorage.setItem(CITIZEN_CODE_KEY, qrCode);
  sessionStorage.removeItem(CITIZEN_PHONE_LAST4_KEY);
}

export function clearCitizenSession() {
  sessionStorage.removeItem(CITIZEN_CODE_KEY);
  sessionStorage.removeItem(CITIZEN_PHONE_LAST4_KEY);
  sessionStorage.removeItem(CITIZEN_TOKEN_KEY);
}