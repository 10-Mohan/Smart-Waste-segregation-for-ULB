import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchDashboardSummary,
  fetchDashboardWards,
  fetchDashboardTrends,
  fetchDashboardHotspots,
  fetchDashboardViolations,
  fetchDashboardReasons
} from '../services/dashboard.js';

export default function useDashboard(filters, options = {}) {
  const [data, setData] = useState({
    summary: null,
    wards: null,
    trends: null,
    heatGrid: null,
    hotspots: null,
    violations: null,
    reasons: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const abortControllerRef = useRef(null);
  const { adminWards = [] } = options; // to fetch heat grid per ward

  const fetchAll = useCallback(async (isSilentRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isSilentRefresh) {
      setLoading(true);
      setError(null);
    }

    try {
      const opts = { signal: controller.signal };
      const heatGridPromises = adminWards.length > 0 
        ? adminWards.map(w => fetchDashboardTrends({ ...filters, wardId: w.id, granularity: 'week' }, opts).then(res => ({ wardId: w.id, ...res })))
        : [fetchDashboardTrends({ ...filters, granularity: 'week' }, opts)];

      const [
        summaryRes,
        wardsRes,
        trendsRes,
        hotspotsRes,
        violationsRes,
        reasonsRes,
        ...heatGridRes
      ] = await Promise.all([
        fetchDashboardSummary(filters, opts),
        fetchDashboardWards(filters, opts),
        fetchDashboardTrends({ ...filters, granularity: 'day' }, opts), // Trend line always day
        fetchDashboardHotspots(filters, opts),
        fetchDashboardViolations(filters, opts),
        fetchDashboardReasons(filters, opts),
        ...heatGridPromises
      ]);

      setData({
        summary: summaryRes,
        wards: wardsRes,
        trends: trendsRes,
        heatGrid: heatGridRes,
        hotspots: hotspotsRes,
        violations: violationsRes,
        reasons: reasonsRes,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      if (err.name === 'CanceledError') return;
      setError(err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters, adminWards]);

  useEffect(() => {
    fetchAll();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAll]);

  // Auto-refresh every 60s if tab is visible
  useEffect(() => {
    let intervalId;
    
    function startInterval() {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchAll(true);
        }
      }, 60000);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchAll(true); // refresh immediately when coming back
        clearInterval(intervalId);
        startInterval();
      } else {
        clearInterval(intervalId);
      }
    }

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAll]);

  return { data, loading, error, refresh: () => fetchAll(false), lastRefreshed };
}
