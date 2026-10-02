import api from './api.js';
import {
  addToQueue,
  getQueue,
  removeFromQueue,
  updateEntry,
} from './offlineQueue.js';

let syncPromise = null;

export function friendlyLogError(error) {
  const status = error.response?.status;
  if (status === 403) return 'This household is outside your assigned ward.';
  if (status === 404) return 'Household not found. Check the code or register it in the Households tab.';
  if (status === 409) return 'This household is inactive or this pickup was already recorded.';
  if (status === 422) return 'Check the pickup details and try again.';
  return 'Could not save this pickup. Check your connection and try again.';
}

function isUnavailable(error) {
  return !error.response || error.response.status >= 500;
}

function queueEntry(entry) {
  return {
    clientUuid: entry.clientUuid,
    qrCode: entry.qrCode,
    status: entry.status,
    reason: entry.reason || undefined,
    note: entry.note || undefined,
    loggedAt: entry.loggedAt,
    attempts: entry.attempts || 0,
    lastError: entry.lastError || '',
    state: 'pending',
  };
}

export async function submitLog(entry) {
  const storedEntry = queueEntry(entry);
  if (!navigator.onLine) {
    await addToQueue(storedEntry);
    return { queued: true, offline: true };
  }

  try {
    const { data } = await api.post('/pickup-logs', entry, { timeout: 10_000 });
    return {
      queued: false,
      duplicate: Boolean(data.duplicate),
    };
  } catch (error) {
    if (isUnavailable(error)) {
      await addToQueue(storedEntry);
      return { queued: true, offline: !error.response };
    }
    const friendly = new Error(friendlyLogError(error));
    friendly.status = error.response?.status;
    throw friendly;
  }
}

function batchFailureMessage(result) {
  const status = result.error?.details?.find((detail) => detail.field === 'reason')
    ? 422
    : undefined;
  if (status) return 'Rejected pickups need a reason before they can sync.';
  const message = result.error?.message?.toLowerCase() || '';
  if (message.includes('ward')) return 'This household is outside your assigned ward.';
  if (message.includes('not found')) return 'Household not found. Check the code or register it in the Households tab.';
  return 'The server rejected this pickup. Review it and retry manually.';
}

async function runSync() {
  const queue = await getQueue();
  const pending = queue.filter((entry) => entry.state === 'pending');
  let synced = 0;
  let failed = 0;

  for (let start = 0; start < pending.length; start += 50) {
    const chunk = pending.slice(start, start + 50);
    let data;
    try {
      const response = await api.post('/pickup-logs/batch', {
        logs: chunk.map((entry) => ({
          clientUuid: entry.clientUuid,
          qrCode: entry.qrCode,
          status: entry.status,
          ...(entry.reason ? { reason: entry.reason } : {}),
          ...(entry.note ? { note: entry.note } : {}),
          loggedAt: entry.loggedAt,
        })),
      }, { timeout: 10_000 });
      data = response.data;
    } catch (error) {
      if (isUnavailable(error)) break;
      const message = 'The sync request was rejected. Check the saved pickups before retrying.';
      await Promise.all(chunk.map(async (entry) => {
        await updateEntry(entry.clientUuid, {
          state: 'failed',
          attempts: (entry.attempts || 0) + 1,
          lastError: message,
        });
      }));
      failed += chunk.length;
      continue;
    }

    const resultByUuid = new Map((data.results || []).map((result) => [result.clientUuid, result]));
    for (const entry of chunk) {
      const result = resultByUuid.get(entry.clientUuid);
      if (result?.result === 'created' || result?.result === 'duplicate') {
        await removeFromQueue(entry.clientUuid);
        synced += 1;
      } else {
        await updateEntry(entry.clientUuid, {
          state: 'failed',
          attempts: (entry.attempts || 0) + 1,
          lastError: result ? batchFailureMessage(result) : 'No sync result was returned. Retry this pickup manually.',
        });
        failed += 1;
      }
    }
  }

  return { synced, failed, pending: (await getQueue()).filter((entry) => entry.state === 'pending').length };
}

export function syncQueue() {
  if (!syncPromise) {
    syncPromise = runSync().finally(() => { syncPromise = null; });
  }
  return syncPromise;
}

export async function retryQueueEntry(clientUuid) {
  await updateEntry(clientUuid, { state: 'pending', lastError: '' });
  return syncQueue();
}