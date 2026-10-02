import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import useOnlineStatus from '../../hooks/useOnlineStatus.js';
import useOfflineQueue from '../../hooks/useOfflineQueue.js';
import Spinner from '../../components/ui/Spinner.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import ScanTab from './ScanTab.jsx';
import TodayTab from './TodayTab.jsx';
import QueueTab from './QueueTab.jsx';
import HouseholdsTab from './HouseholdsTab.jsx';
import { downloadHouseholds, listCachedHouseholds, lookupHousehold } from '../../services/workerHouseholds.js';
import { getCachedHouseholds } from '../../services/offlineQueue.js';
import './worker.css';

const tabs = [
  { id: 'scan', label: 'Scan', icon: <path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3M8 12h8m-4-4v8" /> },
  { id: 'today', label: 'Today', icon: <path d="M5 4v3m14-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Zm3 7h3m-3 3h3m3-3h3m-3 3h3" /> },
  { id: 'queue', label: 'Queue', icon: <path d="M5 6h14M5 12h14M5 18h14M3 6h.01M3 12h.01M3 18h.01" /> },
  { id: 'households', label: 'Households', icon: <path d="m3 11 9-7 9 7M5 10v10h14V10M9 20v-6h6v6" /> },
];

export default function WorkerApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { isOnline, markOffline, markOnline } = useOnlineStatus();
  const queue = useOfflineQueue(isOnline);
  const [activeTab, setActiveTab] = useState('scan');
  const [wardName, setWardName] = useState('Assigned ward');
  const [households, setHouseholds] = useState([]);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const lookupSequence = useRef(0);

  const refreshHouseholds = useCallback(async () => {
    if (!isOnline) {
      setHouseholds(await listCachedHouseholds(user?.wardId));
      return;
    }
    try {
      const downloaded = await downloadHouseholds(user?.wardId);
      setHouseholds(downloaded);
      markOnline();
    } catch {
      markOffline();
      setHouseholds(await listCachedHouseholds(user?.wardId));
    }
  }, [isOnline, markOffline, markOnline, user?.wardId]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        if (navigator.onLine) {
          const [wardResponse] = await Promise.all([
            api.get('/wards'),
            downloadHouseholds(user?.wardId),
          ]);
          const ward = wardResponse.data.wards?.find((item) => item.id === user?.wardId);
          if (active && ward) setWardName(ward.name);
          if (active) setHouseholds(await listCachedHouseholds(user?.wardId));
          if (active) markOnline();
        } else {
          markOffline();
          const cached = await getCachedHouseholds();
          if (active) setHouseholds(cached.filter((household) => household.wardId === user?.wardId));
        }
      } catch {
        markOffline();
        const cached = await getCachedHouseholds();
        if (active) setHouseholds(cached.filter((household) => household.wardId === user?.wardId));
      } finally {
        if (active) setHouseholdsLoading(false);
      }
    }
    initialize();
    return () => { active = false; };
  }, [markOffline, markOnline, user?.wardId]);

  async function resolveHousehold(code) {
    const sequence = ++lookupSequence.current;
    setLookupBusy(true);
    setLookupError('');
    try {
      const result = await lookupHousehold(code);
      if (sequence !== lookupSequence.current) return null;
      if (result.error) {
        setLookupError(result.error);
        return null;
      }
      if (!result.household) {
        setLookupError('Household not found. Check the code or register it in the Households tab.');
        return null;
      }
      if (result.offline) markOffline();
      else markOnline();
      setSelectedHousehold(result.household);
      setLookupError('');
      setActiveTab('scan');
      return result.household;
    } catch {
      markOffline();
      setLookupError('Could not look up this code. Try again or pick a household from the list.');
      return null;
    } finally {
      if (sequence === lookupSequence.current) setLookupBusy(false);
    }
  }

  function onPickupSaved(result) {
    queue.refresh();
    if (result.queued) notify('Saved offline. It will sync when the connection returns.', 'warn');
    if (!result.queued) markOnline();
  }

  return (
    <div className="worker-page">
      <div className="worker-status-strip">
        <span className="worker-status-strip__ward">{wardName}</span>
        <span className="worker-status-strip__right">
          <span className={`worker-status-strip__online${isOnline ? '' : ' is-offline'}`}>
            <span className="worker-status-strip__dot" aria-hidden="true" />
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {queue.pendingCount > 0 && <span className="worker-pending-count" aria-label={`${queue.pendingCount} pickups waiting to sync`}>{queue.pendingCount}</span>}
        </span>
      </div>

      <div className="worker-content">
        {householdsLoading
          ? <div className="worker-loading"><Spinner label="Loading households" /></div>
          : <>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                id={`worker-panel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`worker-tab-${tab.id}`}
                hidden={activeTab !== tab.id}
                tabIndex={0}
              >
                {activeTab === tab.id && tab.id === 'scan' && (
                  <ScanTab
                    household={selectedHousehold}
                    households={households}
                    lookupError={lookupError}
                    lookupBusy={lookupBusy}
                    isOnline={isOnline}
                    markOffline={markOffline}
                    markOnline={markOnline}
                    onLookup={resolveHousehold}
                    onClearLookupError={() => setLookupError('')}
                    onClearHousehold={() => setSelectedHousehold(null)}
                    onSaved={onPickupSaved}
                    onGoToHouseholds={() => setActiveTab('households')}
                  />
                )}
                {activeTab === tab.id && tab.id === 'today' && <TodayTab active households={households} queueEntries={queue.entries} isOnline={isOnline} markOffline={markOffline} markOnline={markOnline} />}
                {activeTab === tab.id && tab.id === 'queue' && <QueueTab queue={queue} households={households} isOnline={isOnline} />}
                {activeTab === tab.id && tab.id === 'households' && (
                  <HouseholdsTab
                    households={households}
                    setHouseholds={setHouseholds}
                    user={user}
                    isOnline={isOnline}
                    markOffline={markOffline}
                    markOnline={markOnline}
                    navigate={navigate}
                    refreshHouseholds={refreshHouseholds}
                  />
                )}
              </div>
            ))}
          </>}
      </div>

      <nav className="worker-tabbar" role="tablist" aria-label="Worker sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="worker-tabbar__tab"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`worker-panel-${tab.id}`}
            id={`worker-tab-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const direction = event.key === 'ArrowRight' ? 1 : -1;
              const current = tabs.findIndex((item) => item.id === activeTab);
              const next = tabs[(current + direction + tabs.length) % tabs.length];
              setActiveTab(next.id);
              document.getElementById(`worker-tab-${next.id}`)?.focus();
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{tab.icon}</svg>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}