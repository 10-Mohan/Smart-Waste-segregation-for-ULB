import { forwardRef, useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Callout from '../../components/ui/Callout.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import useDocumentTitle from '../../hooks/useDocumentTitle.js';
import { getCitizenStatus } from '../../services/citizenService.js';
import StatusBadge, { statusLabel } from '../worker/StatusBadge.jsx';
import CitizenQrSheet from './CitizenQrSheet.jsx';
import './citizen.css';

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function CountUp({ value }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(target);
      return undefined;
    }
    const started = performance.now();
    const startValue = display;
    let frame;
    const animate = (now) => {
      const progress = Math.min(1, (now - started) / 500);
      setDisplay(Math.round(startValue + (target - startValue) * progress));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <>{display}</>;
}

function WeeklyRing({ score, details }) {
  if (score === null || score === undefined || !details?.total) {
    return <p className="citizen-muted">Your weekly score will appear after your first pickup.</p>;
  }
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="citizen-weekly-ring">
      <svg viewBox="0 0 104 104" role="img" aria-label={`Weekly compliance ${score} percent`}>
        <circle className="citizen-weekly-ring__track" cx="52" cy="52" r={radius} />
        <circle className="citizen-weekly-ring__value" cx="52" cy="52" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
        <text x="52" y="57" textAnchor="middle">{score}%</text>
      </svg>
      <p>{details.segregated} of {details.total} pickups segregated this week</p>
    </div>
  );
}

function BalanceChart({ entries }) {
  if (!entries.length) return null;
  const points = [...entries].reverse();
  const balances = points.map((entry) => Number(entry.balanceAfter) || 0);
  const maximum = Math.max(...balances, 1);
  const coordinates = balances.map((balance, index) => {
    const x = points.length === 1 ? 50 : 4 + (index / (points.length - 1)) * 92;
    const y = 40 - (balance / maximum) * 34;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="citizen-balance-chart" viewBox="0 0 100 44" role="img" aria-label="Points balance over the last recorded entries">
      <polyline points={coordinates} fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {balances.length === 1 && <circle cx="50" cy={40 - (balances[0] / maximum) * 34} r="2.5" fill="var(--color-brand)" />}
    </svg>
  );
}

const CitizenDashboard = forwardRef(function CitizenDashboard({ code, phoneLast4, initialStatus, onSwitchHousehold, onSessionStale, onStatusUpdate }, headingRef) {
  const [status, setStatus] = useState(initialStatus);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedText, setUpdatedText] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [pickupFilter, setPickupFilter] = useState('all');
  const [qrOpen, setQrOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => sessionStorage.getItem(`citizen-last-seen:${code}`) || '');
  const { notify } = useToast();
  useDocumentTitle('My household');

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const nextStatus = await getCitizenStatus(code, phoneLast4);
      setStatus(nextStatus);
      onStatusUpdate(nextStatus);
      setRefreshError('');
      setUpdatedText('Updated just now');
      if (!quiet) notify('Updated', 'good');
    } catch (error) {
      const isStale = error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403;
      if (isStale) {
        if (onSessionStale) {
          onSessionStale("We couldn't find that household. Please check your details or register again.");
          return;
        }
      }
      setRefreshError("Can't refresh right now. Check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  }, [code, notify, onSessionStale, onStatusUpdate, phoneLast4]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) refresh(true);
    }, 30_000);
    function onVisibilityChange() {
      if (!document.hidden) refresh(true);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (activeTab !== 'messages') return;
    const seenAt = new Date().toISOString();
    sessionStorage.setItem(`citizen-last-seen:${code}`, seenAt);
    setLastSeen(seenAt);
  }, [activeTab, code]);

  const logs = status.logs || [];
  const pointsHistory = status.pointsHistory || [];
  const pointsByPickup = new Map();
  for (const item of pointsHistory) {
    const pickupId = item.pickup?.id;
    if (pickupId) pointsByPickup.set(pickupId, (pointsByPickup.get(pickupId) || 0) + Number(item.points || 0));
  }

  const streak = logs.reduce((count, log) => {
    if (count === null || log.status !== 'segregated') return null;
    return count + 1;
  }, 0) ?? 0;
  const streakInterval = Number(status.pointsRules?.consecutiveSegregatedBonusInterval);
  const untilBonus = streakInterval > 0 ? streakInterval - (streak % streakInterval || 0) : null;
  const latestProblem = logs.find((log) => log.status === 'mixed' || log.status === 'rejected');
  const unreadCount = (status.notifications || []).filter((message) => !lastSeen || new Date(message.createdAt) > new Date(lastSeen)).length;
  const filteredLogs = logs.filter((log) => pickupFilter === 'all' || log.status === pickupFilter);

  const pickupsContent = (
    <div className="citizen-tab-content">
      <div className="citizen-filter-chips" role="group" aria-label="Filter pickups">
        {['all', 'segregated', 'mixed', 'rejected'].map((filter) => (
          <button key={filter} type="button" className="citizen-filter-chip" aria-pressed={pickupFilter === filter} onClick={() => setPickupFilter(filter)}>
            {filter === 'all' ? 'All' : statusLabel(filter)}
          </button>
        ))}
      </div>
      {filteredLogs.length
        ? <ul className="citizen-activity-list">
          {filteredLogs.map((log, index) => {
            const earned = pointsByPickup.get(log.id) || 0;
            return (
              <li key={log.id || `${log.date}-${index}`}>
                <Card className="citizen-activity-row">
                  <div className="citizen-activity-row__top">
                    <StatusBadge status={log.status} />
                    <time dateTime={log.date}>{formatDate(log.date, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </div>
                  {log.reason && (log.status === 'rejected' || log.status === 'mixed') && <p>{log.reason}</p>}
                  {earned > 0 && <p className="citizen-earned-points">+{earned} points</p>}
                </Card>
              </li>
            );
          })}
        </ul>
        : <EmptyState title="No pickups here yet" description="Try another filter or check back after your next collection." />}
    </div>
  );

  const pointsContent = (
    <div className="citizen-tab-content">
      <Card className="citizen-points-balance">
        <p className="citizen-kicker">Current balance</p>
        <p className="citizen-points-balance__value"><CountUp value={status.ecoPoints} /></p>
        <p>eco-points</p>
        <BalanceChart entries={pointsHistory} />
      </Card>
      {pointsHistory.length
        ? <ul className="citizen-activity-list">
          {pointsHistory.map((entry, index) => (
            <li key={`${entry.pickup?.id || 'pickup'}-${entry.date}-${index}`}>
              <Card className="citizen-points-row">
                <div>
                  <p className="citizen-earned-points">{entry.points > 0 ? `+${entry.points}` : entry.points} points</p>
                  <p>{entry.reason}</p>
                  <time dateTime={entry.date}>{formatDate(entry.date, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </div>
                <Badge variant="neutral">Balance {entry.balanceAfter}</Badge>
              </Card>
            </li>
          ))}
        </ul>
        : <EmptyState title="No points yet" description="Segregated pickups earn points." />}
    </div>
  );

  const messagesContent = (
    <div className="citizen-tab-content">
      {(status.notifications || []).length
        ? <ul className="citizen-activity-list">
          {status.notifications.map((message) => {
            const unread = !lastSeen || new Date(message.createdAt) > new Date(lastSeen);
            return (
              <li key={message.id}>
                <Card className="citizen-message-row">
                  <div className="citizen-message-row__head">
                    <time dateTime={message.createdAt}>{formatDate(message.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                    {unread && <span className="citizen-unread-dot" role="img" aria-label="Unread message" />}
                  </div>
                  <p>{message.message}</p>
                </Card>
              </li>
            );
          })}
        </ul>
        : <EmptyState title="No messages yet" description="Pickup updates will appear here." />}
    </div>
  );

  const tabItems = [
    { id: 'overview', label: 'Overview', content: (
      <div className="citizen-tab-content">
        <div className="citizen-overview-grid">
          <StatCard className="citizen-overview-points" value={<CountUp value={status.ecoPoints} />} label="Eco-points" note="Current balance" />
          <Card>
            <h2 className="citizen-card-title">Weekly score</h2>
            <WeeklyRing score={status.weeklyComplianceScore} details={status.weeklyComplianceDetails} />
          </Card>
          <Card>
            <h2 className="citizen-card-title">Segregation streak</h2>
            {logs.length
              ? <p className="citizen-streak-copy"><strong>{streak}</strong> consecutive segregated {streak === 1 ? 'pickup' : 'pickups'}.{untilBonus !== null ? ` ${untilBonus} more until the next bonus.` : ''}</p>
              : <p className="citizen-muted">Your streak will begin after your first pickup.</p>}
          </Card>
        </div>
        <Callout className="citizen-tips" variant="note" title="Tips for you">
          {status.tips || 'Thanks for taking care to sort your household waste.'}
        </Callout>
      </div>
    ) },
    { id: 'pickups', label: 'Pickups', content: pickupsContent },
    { id: 'points', label: 'Points', content: pointsContent },
    { id: 'messages', label: <span className="citizen-tab-label">Messages{unreadCount > 0 && <span className="citizen-tab-unread" aria-label={`${unreadCount} unread messages`} />}</span>, content: messagesContent },
  ];

  return (
    <div className="citizen-dashboard">
      <header className="citizen-dashboard__header">
        <div>
          <p className="citizen-kicker">{status.wardName}</p>
          <h1 ref={headingRef} tabIndex={-1}>Hi, {status.household.name}</h1>
          <p className="citizen-household-code">{code}</p>
        </div>
        <div className="citizen-dashboard__actions">
          <Button className="citizen-touch-button" variant="secondary" onClick={() => setQrOpen(true)}>Show my QR</Button>
          <Button className="citizen-touch-button" disabled={refreshing} onClick={() => refresh()}>
            {refreshing ? <Spinner size="sm" label="Refreshing" /> : 'Refresh'}
          </Button>
        </div>
      </header>
      <div className="citizen-updated" aria-live="polite">{updatedText}</div>
      {refreshError && <Callout variant="warning">{refreshError}</Callout>}

      {logs.length === 0
        ? <Callout className="citizen-status-banner citizen-status-banner--neutral" variant="note" title="Welcome!">Your first pickup will show up here.</Callout>
        : status.currentStatus === 'green'
          ? <Callout className="citizen-status-banner citizen-status-banner--good" variant="info" title="✓ You're on track - nice work segregating!" />
          : <Callout className="citizen-status-banner citizen-status-banner--bad" variant="warning" title="! Your last pickup needs attention">
            {latestProblem?.reason || status.tips || 'Please check your last pickup details.'}
          </Callout>}

      <Tabs label="Household dashboard sections" items={tabItems} defaultTab="overview" onChange={setActiveTab} />

      <div className="citizen-dashboard__switch">
        <button className="citizen-link-button" type="button" onClick={onSwitchHousehold}>Not you? Switch household</button>
      </div>
      {qrOpen && <CitizenQrSheet code={code} firstName={status.household.name} wardName={status.wardName} onClose={() => setQrOpen(false)} />}
    </div>
  );
});

export default CitizenDashboard;