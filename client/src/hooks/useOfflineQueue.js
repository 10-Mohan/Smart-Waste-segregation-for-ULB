import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueue } from '../services/offlineQueue.js';
import { syncQueue } from '../services/logService.js';

export default function useOfflineQueue(isOnline) {
  const [entries, setEntries] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const lastAutoSync = useRef('');

  const refresh = useCallback(async () => {
    setEntries(await getQueue());
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline || syncing) return { synced: 0, failed: 0 };
    setSyncing(true);
    setSyncProgress('Syncing saved pickups…');
    try {
      const result = await syncQueue();
      await refresh();
      setSyncProgress(result.failed ? 'Some pickups need review.' : result.synced ? 'Pickups synced.' : 'Everything is synced.');
      return result;
    } finally {
      setSyncing(false);
    }
  }, [isOnline, refresh, syncing]);

  useEffect(() => {
    let active = true;
    const update = async () => {
      const next = await getQueue();
      if (active) setEntries(next);
    };
    update();
    const onOnline = () => { syncQueue().then(update).catch(() => {}); };
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    const pendingSignature = entries
      .filter((entry) => entry.state === 'pending')
      .map((entry) => entry.clientUuid)
      .join('|');
    if (!pendingSignature) {
      lastAutoSync.current = '';
      return;
    }
    if (isOnline && pendingSignature !== lastAutoSync.current) {
      lastAutoSync.current = pendingSignature;
      syncNow().catch(() => {});
    }
  }, [entries, isOnline, syncNow]);

  useEffect(() => {
    const hasPending = entries.some((entry) => entry.state === 'pending');
    if (!isOnline || !hasPending) return undefined;
    const timer = window.setInterval(() => {
      syncQueue().then(refresh).catch(() => {});
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [entries, isOnline, refresh]);

  return {
    entries,
    pendingCount: entries.filter((entry) => entry.state === 'pending').length,
    syncing,
    syncProgress,
    refresh,
    syncNow,
  };
}