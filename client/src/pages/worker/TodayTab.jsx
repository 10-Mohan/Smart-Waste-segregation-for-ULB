import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api.js';
import Card from '../../components/ui/Card.jsx';
import Callout from '../../components/ui/Callout.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import StatusBadge from './StatusBadge.jsx';

function localDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1);
  return { from: start, to: end };
}

function timeOf(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export default function TodayTab({ active, households, queueEntries, isOnline, markOffline, markOnline }) {
  const [serverLogs, setServerLogs] = useState([]);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const { from, to } = useMemo(localDayBounds, []);

  useEffect(() => {
    if (!active) return undefined;
    if (!isOnline) {
      setServerLogs([]);
      setServerAvailable(false);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api.get('/pickup-logs', { params: { from: from.toISOString(), to: to.toISOString(), page: 1, limit: 100 } })
      .then(({ data }) => {
        if (cancelled) return;
        setServerLogs((data.logs || []).map((log) => ({
          id: log.id,
          clientUuid: log.clientUuid,
          status: log.status,
          loggedAt: log.loggedAt,
          household: log.household ? {
            ownerName: log.household.ownerName,
            qrCode: log.household.qrCode,
          } : null,
        })));
        setServerAvailable(true);
        markOnline();
      })
      .catch(() => {
        if (cancelled) return;
        setServerAvailable(false);
        markOffline();
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, from, isOnline, markOffline, markOnline, to]);

  const logs = useMemo(() => {
    const householdByCode = new Map(households.map((household) => [household.qrCode, household]));
    const queuedUuids = new Set(queueEntries.map((entry) => entry.clientUuid));
    const serverRows = serverLogs
      .filter((log) => !queuedUuids.has(log.clientUuid))
      .map((log) => ({
        clientUuid: log.clientUuid || `server-${log.id}`,
        ownerName: log.household?.ownerName || 'Household',
        qrCode: log.household?.qrCode || 'Unknown code',
        status: log.status,
        loggedAt: log.loggedAt,
        waiting: false,
      }));
    const queuedRows = queueEntries
      .filter((entry) => new Date(entry.loggedAt) >= from && new Date(entry.loggedAt) <= to)
      .map((entry) => ({
        clientUuid: entry.clientUuid,
        ownerName: householdByCode.get(entry.qrCode)?.ownerName || 'Household',
        qrCode: entry.qrCode,
        status: entry.status,
        loggedAt: entry.loggedAt,
        waiting: entry.state === 'pending',
      }));
    return [...serverRows, ...queuedRows].sort((first, second) => new Date(second.loggedAt) - new Date(first.loggedAt));
  }, [from, households, queueEntries, serverLogs, to]);

  const counts = useMemo(() => {
    const total = logs.length;
    const segregated = logs.filter((log) => log.status === 'segregated').length;
    const mixed = logs.filter((log) => log.status === 'mixed').length;
    const rejected = logs.filter((log) => log.status === 'rejected').length;
    const percentage = total ? Math.round((segregated / total) * 100) : 0;
    return { total, segregated, mixed, rejected, percentage };
  }, [logs]);

  return (
    <section>
      <SectionHeader className="worker-section-heading" as="h1" eyebrow="Today" title="Today's pickups" lead="Device local day" />
      {!serverAvailable && <Callout variant="note">Showing saved pickups only because the server is unavailable.</Callout>}
      <div className="worker-today-stats">
        <StatCard value={counts.total} label="Total logged" />
        <StatCard value={counts.segregated} label="Segregated" />
        <StatCard value={counts.mixed} label="Mixed" />
        <StatCard value={counts.rejected} label="Rejected" />
        <StatCard value={`${counts.percentage}%`} label="Segregated share" />
      </div>
      {loading && logs.length === 0
        ? <p className="worker-help">Loading today's pickups…</p>
        : logs.length === 0
          ? <EmptyState title="No pickups logged today" description="Completed pickups will appear here." />
          : <ul className="worker-log-list">
            {logs.map((log) => (
              <li key={log.clientUuid}>
                <Card className="worker-log-row">
                  <div className="worker-log-row__main">
                    <div>
                      <p className="worker-list-row__primary">{log.ownerName}</p>
                      <p className="worker-household-card__code">{log.qrCode}</p>
                    </div>
                    <time dateTime={log.loggedAt}>{timeOf(log.loggedAt)}</time>
                  </div>
                  <div className="worker-last-logs">
                    <StatusBadge status={log.status} />
                    {log.waiting && <span className="worker-waiting-chip">Waiting to sync</span>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>}
    </section>
  );
}