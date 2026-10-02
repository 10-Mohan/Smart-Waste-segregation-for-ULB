import { createStore, del, entries, get, set } from 'idb-keyval';

const queueStore = createStore('waste-collection-queue', 'entries');
const householdStore = createStore('waste-collection-households', 'records');
const queueKey = 'entries';

export async function getQueue() {
  return (await get(queueKey, queueStore)) || [];
}

export async function addToQueue(entry) {
  const current = await getQueue();
  if (!current.some((item) => item.clientUuid === entry.clientUuid)) {
    await set(queueKey, [...current, entry], queueStore);
  }
}

export async function removeFromQueue(clientUuid) {
  const current = await getQueue();
  await set(queueKey, current.filter((entry) => entry.clientUuid !== clientUuid), queueStore);
}

export async function updateEntry(clientUuid, patch) {
  const current = await getQueue();
  await set(queueKey, current.map((entry) => (
    entry.clientUuid === clientUuid ? { ...entry, ...patch } : entry
  )), queueStore);
}

export async function clearSynced() {
  const current = await getQueue();
  await set(queueKey, current.filter((entry) => entry.state !== 'synced'), queueStore);
}

export async function cacheHouseholds(households) {
  await Promise.all(households.map((household) => set(household.qrCode, household, householdStore)));
}

export async function getCachedHousehold(qrCode) {
  return get(String(qrCode).trim().toUpperCase(), householdStore);
}

export async function getCachedHouseholds() {
  const cached = await entries(householdStore);
  return cached.map(([, household]) => household);
}

export async function clearHouseholdCache() {
  const cached = await entries(householdStore);
  await Promise.all(cached.map(([qrCode]) => del(qrCode, householdStore)));
}