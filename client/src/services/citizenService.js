import api from './api.js';

export const CITIZEN_CODE_KEY = 'citizen-household-code';
export const CITIZEN_PHONE_LAST4_KEY = 'citizen-phone-last4';

export async function getCitizenWards() {
  const { data } = await api.get('/citizen/wards');
  return data;
}

export async function registerCitizenHousehold(details) {
  const { data } = await api.post('/citizen/register', details);
  return data;
}

export async function getCitizenStatus(qrCode, phoneLast4) {
  const { data } = await api.get('/citizen/status', { params: { qrCode, phoneLast4 } });
  return data;
}

export function saveCitizenSession(qrCode, phoneLast4) {
  sessionStorage.setItem(CITIZEN_CODE_KEY, qrCode);
  sessionStorage.setItem(CITIZEN_PHONE_LAST4_KEY, phoneLast4);
}

export function clearCitizenSession() {
  sessionStorage.removeItem(CITIZEN_CODE_KEY);
  sessionStorage.removeItem(CITIZEN_PHONE_LAST4_KEY);
}