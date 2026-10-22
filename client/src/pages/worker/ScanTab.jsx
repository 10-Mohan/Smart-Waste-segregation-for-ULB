import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Card from '../../components/ui/Card.jsx';
import Callout from '../../components/ui/Callout.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import QrCameraScanner from '../../components/QrCameraScanner.jsx';
import { submitLog, friendlyLogError } from '../../services/logService.js';
import BottomSheet from './BottomSheet.jsx';
import StatusBadge, { statusLabel } from './StatusBadge.jsx';
import AISheet from '../../ai/AISheet.jsx';

const rejectionReasons = [
  'Hazardous items in dry bin',
  'Sanitary waste mixed',
  'Food waste in dry bin',
  'Plastic in wet bin',
  'E-waste found',
  'Other',
];

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export default function ScanTab({
  household,
  households,
  lookupError,
  lookupBusy,
  isOnline,
  markOffline,
  markOnline,
  onLookup,
  onClearLookupError,
  onSaved,
  onClearHousehold,
  onGoToHouseholds,
}) {
  const [code, setCode] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const savingRef = useRef(false);
  const lastSavedRef = useRef(new Map());
  const successTimer = useRef(null);
  const { notify } = useToast();

  useEffect(() => () => window.clearTimeout(successTimer.current), []);

  // A new household means any earlier AI suggestion no longer applies.
  useEffect(() => { setAiSuggestion(null); setAiOpen(false); }, [household?.qrCode]);

  function openSuccess(result, status) {
    const saved = {
      name: household.ownerName,
      status,
      queued: result.queued,
    };
    setSuccess(saved);
    onSaved(result);
    successTimer.current = window.setTimeout(() => {
      setSuccess(null);
      onClearHousehold();
      setCode('');
    }, 2000);
  }

  async function saveStatus(status, selectedReason = '', selectedNote = '') {
    if (!household || savingRef.current) return;
    const now = Date.now();
    const previousSave = lastSavedRef.current.get(household.qrCode) || 0;
    if (now - previousSave < 3000) {
      setSaveError('This household was just logged. Wait a moment before recording it again.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    const loggedAt = new Date(now).toISOString();
    lastSavedRef.current.set(household.qrCode, now);
    const entry = {
      clientUuid: crypto.randomUUID(),
      qrCode: household.qrCode,
      status,
      ...(selectedReason ? { reason: selectedReason } : {}),
      ...(selectedNote.trim() ? { note: selectedNote.trim() } : {}),
      loggedAt,
    };

    try {
      const result = await submitLog(entry);
      if (result.queued && navigator.onLine) markOffline();
      else if (!result.queued) markOnline();
      setRejectOpen(false);
      setReason('');
      setOtherReason('');
      setNote('');
      setAiSuggestion(null);
      openSuccess(result, status);
    } catch (error) {
      lastSavedRef.current.delete(household.qrCode);
      if (!navigator.onLine) markOffline();
      setSaveError(error.message || friendlyLogError(error));
      notify(error.message || 'Pickup could not be saved. Please try again.', 'bad');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleManualLookup(event) {
    event.preventDefault();
    onClearLookupError();
    const normalized = code.trim().toUpperCase();
    setCode(normalized);
    await onLookup(normalized);
  }

  async function chooseHousehold(item) {
    const found = await onLookup(item.qrCode);
    if (found) setPickerOpen(false);
  }

  async function confirmRejected() {
    const selectedReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!selectedReason) {
      setSaveError('Choose a reason. If you select Other, enter a reason before confirming.');
      return;
    }
    await saveStatus('rejected', selectedReason, note);
  }

  function handleAiApply(suggestion) {
    setAiSuggestion(suggestion);
    setAiOpen(false);
    setSaveError('');
    if (suggestion.status === 'rejected') {
      const known = rejectionReasons.includes(suggestion.reason) && suggestion.reason !== 'Other';
      setReason(known ? suggestion.reason : 'Other');
      setOtherReason(known ? '' : (suggestion.reasonText || 'See AI note').slice(0, 255));
      setNote(suggestion.note);
    } else {
      setReason('');
      setOtherReason('');
      setNote('');
    }
  }

  function scanNext() {
    window.clearTimeout(successTimer.current);
    setSuccess(null);
    setAiSuggestion(null);
    onClearHousehold();
    setCode('');
  }

  const filteredHouseholds = households.filter((item) => (
    `${item.ownerName} ${item.address} ${item.qrCode}`.toLowerCase().includes(search.toLowerCase())
  ));

  if (success) {
    return (
      <section className="worker-success" aria-live="polite" aria-atomic="true">
        <span className="worker-success__mark" aria-hidden="true">✓</span>
        <h1>{success.name}</h1>
        <p>{success.queued ? 'Saved offline - will sync' : `${statusLabel(success.status)} logged`}</p>
        <Button className="worker-touch-button" onClick={scanNext}>Scan next</Button>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader className="worker-section-heading" as="h1" eyebrow="Scan" title="Log a pickup" lead="Scan a bin code or look up the household." />
      <div className="worker-stack">
        <Card className="worker-scan-card">
          <QrCameraScanner onScan={(scannedCode) => { setCode(scannedCode); onLookup(scannedCode); }} startLabel="Start camera" />
        </Card>

        <form className="worker-code-form" onSubmit={handleManualLookup}>
          <div className="worker-field">
            <label htmlFor="worker-household-code">Household QR code</label>
            <input
              id="worker-household-code"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              placeholder="HH-W01-001"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onFocus={onClearLookupError}
            />
          </div>
          <Button className="worker-touch-button" type="submit" disabled={lookupBusy || !code.trim()}>
            {lookupBusy ? 'Looking up…' : 'Look up'}
          </Button>
        </form>

        <Button className="worker-touch-button" variant="secondary" onClick={() => { setSearch(''); setPickerOpen(true); }}>
          Pick from list
        </Button>

        {lookupError && <p className="worker-error" role="alert">{lookupError}</p>}
        {saveError && <p className="worker-error" role="alert">{saveError}</p>}

        {household && (
          <div className="worker-stack">
            <Card className="worker-household-card">
              <div className="worker-household-card__header">
                <div>
                  <p className="worker-kicker">Household</p>
                  <h2>{household.ownerName}</h2>
                </div>
                <Badge variant="neutral">{household.type === 'commercial' ? 'Commercial' : 'Residential'}</Badge>
              </div>
              <div className="worker-household-card__details">
                <p>{household.address}</p>
                <p><span className="worker-household-card__code">{household.qrCode}</span></p>
              </div>
              {household.pickupLogs?.length > 0 && (
                <div className="worker-stack-sm">
                  <h3 className="worker-subheading">Recent pickups</h3>
                  <div className="worker-last-logs">
                    {household.pickupLogs.slice(0, 3).map((log) => (
                      <span className="worker-last-log" key={log.id}>
                        <StatusBadge status={log.status} />
                        <time dateTime={log.loggedAt}>{formatDate(log.loggedAt)}</time>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {household.awayUntil && household.awayUntil >= localToday() && (
                <Callout variant="note">The family marked themselves away until {household.awayUntil}. You may want to skip this visit.</Callout>
              )}
              {household.preferredWindow && (
                <p className="worker-help">Prefers pickup in the {household.preferredWindow}.</p>
              )}
              {!isOnline && <Callout variant="note">This household was loaded from the saved ward list.</Callout>}
            </Card>

            <Button className="worker-touch-button" variant="secondary" disabled={saving} onClick={() => setAiOpen(true)}>
              Check with AI
            </Button>
            {aiSuggestion && (
              <Callout variant="note">
                AI suggests <strong>{aiSuggestion.status}</strong> ({aiSuggestion.confidence}% confident). Tap the matching button below to confirm, or choose a different one.
              </Callout>
            )}

            <div className="worker-status-buttons" aria-label="Log pickup status">
              <button className="worker-status-button worker-status-button--segregated" type="button" disabled={saving} onClick={() => saveStatus('segregated', '', aiSuggestion?.note || '')}>
                <span aria-hidden="true">✓</span> Segregated
              </button>
              <button className="worker-status-button worker-status-button--mixed" type="button" disabled={saving} onClick={() => saveStatus('mixed', '', aiSuggestion?.note || '')}>
                <span aria-hidden="true">!</span> Mixed
              </button>
              <button className="worker-status-button worker-status-button--rejected" type="button" disabled={saving} onClick={() => { setSaveError(''); setRejectOpen(true); }}>
                <span aria-hidden="true">×</span> Rejected
              </button>
            </div>
              <Button className="worker-touch-button" variant="secondary" disabled={saving} onClick={() => saveStatus('not_available')}>
              No one home
            </Button>
            <button className="worker-link-button" type="button" onClick={scanNext}>Cancel / scan another</button>
            {saving && <Spinner label="Saving pickup" />}
          </div>
        )}
      </div>

      {aiOpen && <AISheet onClose={() => setAiOpen(false)} onApply={handleAiApply} />}

      {pickerOpen && (
        <BottomSheet title="Pick a household" onClose={() => setPickerOpen(false)}>
          <div className="worker-field">
            <label htmlFor="worker-household-search">Search by name, address or code</label>
            <input id="worker-household-search" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {filteredHouseholds.length
            ? <ul className="worker-list">
              {filteredHouseholds.map((item) => (
                <li key={item.qrCode}>
                  <button className="worker-list-row" type="button" disabled={lookupBusy} onClick={() => chooseHousehold(item)}>
                    <span className="worker-list-row__primary">{item.ownerName}</span>
                    <span className="worker-list-row__secondary">{item.address}</span>
                    <span className="worker-household-card__code">{item.qrCode}</span>
                  </button>
                </li>
              ))}
            </ul>
            : <p className="worker-help">No households match this search.</p>}
          <button className="worker-link-button" type="button" onClick={() => { setPickerOpen(false); onGoToHouseholds(); }}>Register a household</button>
        </BottomSheet>
      )}

      {rejectOpen && (
        <BottomSheet title="Why was this pickup rejected?" onClose={() => setRejectOpen(false)}>
          <p className="worker-help">Choose one reason. Add a note if needed.</p>
          <div className="worker-reason-list">
            {rejectionReasons.map((item) => (
              <button key={item} className="worker-reason-chip" type="button" aria-pressed={reason === item} onClick={() => { setReason(item); setSaveError(''); }}>
                {item}
              </button>
            ))}
          </div>
          {reason === 'Other' && (
            <div className="worker-field">
              <label htmlFor="worker-other-reason">Reason</label>
              <input id="worker-other-reason" maxLength={255} value={otherReason} onChange={(event) => setOtherReason(event.target.value)} />
            </div>
          )}
          <div className="worker-field">
            <label htmlFor="worker-rejection-note">Optional note</label>
            <textarea id="worker-rejection-note" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          {saveError && <p className="worker-error" role="alert">{saveError}</p>}
          <Button className="worker-touch-button" disabled={saving || !reason || (reason === 'Other' && !otherReason.trim())} onClick={confirmRejected}>
            Confirm rejection
          </Button>
        </BottomSheet>
      )}
    </section>
  );
}