import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatusBadge from './StatusBadge.jsx';
import { removeFromQueue } from '../../services/offlineQueue.js';
import { retryQueueEntry } from '../../services/logService.js';

function timeOf(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function QueueTab({ queue, households, isOnline }) {
  const [retryingId, setRetryingId] = useState('');
  const householdByCode = new Map(households.map((household) => [household.qrCode, household]));
  const visibleEntries = queue.entries.filter((entry) => entry.state === 'pending' || entry.state === 'failed');

  async function retry(clientUuid) {
    setRetryingId(clientUuid);
    try {
      await retryQueueEntry(clientUuid);
      await queue.refresh();
    } finally {
      setRetryingId('');
    }
  }

  async function remove(entry) {
    const accepted = window.confirm(`Remove the failed pickup for ${entry.qrCode}?`);
    if (!accepted) return;
    await removeFromQueue(entry.clientUuid);
    await queue.refresh();
  }

  return (
    <section>
      <SectionHeader className="worker-section-heading" as="h1" eyebrow="Queue" title="Saved pickups" lead="Pending and failed pickups on this device." />
      {queue.syncProgress && <p className="worker-help" aria-live="polite">{queue.syncProgress}</p>}
      {visibleEntries.some((entry) => entry.state === 'pending') && (
        <div className="worker-queue-action">
          <Button className="worker-touch-button" disabled={!isOnline || queue.syncing} onClick={queue.syncNow}>
            {queue.syncing ? <Spinner size="sm" label="Syncing" /> : 'Sync now'}
          </Button>
          {!isOnline && <p className="worker-help">Connect to the internet to sync saved pickups.</p>}
        </div>
      )}
      {visibleEntries.length === 0
        ? <EmptyState title="Everything is synced." description="There are no saved pickups waiting for attention." />
        : <ul className="worker-log-list">
          {visibleEntries.map((entry) => {
            const household = householdByCode.get(entry.qrCode);
            return (
              <li key={entry.clientUuid}>
                <Card className="worker-queue-card">
                  <div className="worker-queue-card__head">
                    <div>
                      <p className="worker-list-row__primary">{entry.qrCode}</p>
                      {household && <p className="worker-list-row__secondary">{household.ownerName}</p>}
                    </div>
                    <StatusBadge status={entry.status} />
                  </div>
                  <p className="worker-list-row__secondary">Logged {timeOf(entry.loggedAt)}</p>
                  <p className="worker-list-row__secondary">Attempts: {entry.attempts || 0}</p>
                  {entry.state === 'failed' && <p className="worker-error">{entry.lastError || 'This pickup was rejected by the server.'}</p>}
                  {entry.state === 'failed' && (
                    <div className="worker-button-row">
                      <Button className="worker-touch-button" size="sm" disabled={!isOnline || retryingId === entry.clientUuid} onClick={() => retry(entry.clientUuid)}>
                        {retryingId === entry.clientUuid ? 'Retrying…' : 'Retry'}
                      </Button>
                      <Button className="worker-touch-button" size="sm" variant="ghost" onClick={() => remove(entry)}>Remove</Button>
                    </div>
                  )}
                  {entry.state === 'pending' && <p className="worker-waiting-chip">Waiting to sync</p>}
                </Card>
              </li>
            );
          })}
        </ul>}
    </section>
  );
}