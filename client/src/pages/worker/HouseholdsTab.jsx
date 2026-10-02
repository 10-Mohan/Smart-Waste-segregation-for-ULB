import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/api.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import BottomSheet from './BottomSheet.jsx';
import StatusBadge from './StatusBadge.jsx';
import { lookupHousehold, getPrintablePayload } from '../../services/workerHouseholds.js';
import { cacheHouseholds } from '../../services/offlineQueue.js';

function workerHousehold(household) {
  return {
    id: household.id,
    qrCode: household.qrCode,
    ownerName: household.ownerName,
    phone: household.phone,
    address: household.address,
    type: household.type,
    wardId: household.wardId,
    active: household.active,
    ward: household.ward ? { id: household.ward.id, name: household.ward.name, code: household.ward.code } : undefined,
    pickupLogs: household.pickupLogs?.map((log) => ({ id: log.id, status: log.status, reason: log.reason, loggedAt: log.loggedAt })),
  };
}

export default function HouseholdsTab({ households, setHouseholds, user, isOnline, markOffline, markOnline, navigate, refreshHouseholds }) {
  const [search, setSearch] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [registered, setRegistered] = useState(null);
  const [form, setForm] = useState({ ownerName: '', phone: '', address: '', type: 'residential' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = useMemo(() => households
    .filter((household) => `${household.qrCode} ${household.ownerName} ${household.address}`.toLowerCase().includes(search.toLowerCase()))
    .sort((first, second) => first.qrCode.localeCompare(second.qrCode)), [households, search]);

  async function openDetails(household) {
    setDetailLoading(true);
    const result = await lookupHousehold(household.qrCode);
    if (result.error) {
      setError(result.error);
      setSelected(household);
    } else {
      setSelected(result.household || household);
      if (result.offline) markOffline();
      else markOnline();
    }
    setDetailLoading(false);
  }

  async function register(event) {
    event.preventDefault();
    if (!isOnline) return;
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/households', { ...form, wardId: user.wardId });
      const household = workerHousehold(data.household);
      await cacheHouseholds([household]);
      setHouseholds((current) => [...current.filter((item) => item.qrCode !== household.qrCode), household]);
      setRegistered(household);
      setRegisterOpen(false);
      setForm({ ownerName: '', phone: '', address: '', type: 'residential' });
      markOnline();
    } catch (requestError) {
      if (!requestError.response) markOffline();
      setError(requestError.response?.status === 403
        ? 'You can only register households in your assigned ward.'
        : 'Household could not be registered. Check the details and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function printHousehold(household) {
    if (isOnline && household.id) {
      try {
        await getPrintablePayload(household);
        markOnline();
      } catch {
        markOffline();
      }
    }
    navigate(`/worker/labels?code=${encodeURIComponent(household.qrCode)}`);
  }

  async function openRegistration() {
    setRegistered(null);
    setError('');
    if (isOnline) {
      setRegisterOpen(true);
      return;
    }
    await refreshHouseholds();
    setError('Connect to the internet to register a household.');
  }

  return (
    <section>
      <SectionHeader className="worker-section-heading" as="h1" eyebrow="Households" title="Your ward" lead="Find or register a collection point." />
      <div className="worker-stack">
        <div className="worker-field">
          <label htmlFor="household-filter">Search households</label>
          <input id="household-filter" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, address or code" />
        </div>
        {!isOnline && <p className="worker-note">Offline mode: saved households are available. Registration needs an internet connection.</p>}
        <div className="worker-household-actions">
          <Button className="worker-touch-button" disabled={!isOnline} onClick={openRegistration}>Register household</Button>
          <Button className="worker-touch-button" variant="secondary" onClick={() => navigate('/worker/labels')}>Print all labels</Button>
        </div>
        {error && !registerOpen && !selected && <p className="worker-error" role="alert">{error}</p>}
        {filtered.length === 0
          ? <EmptyState title="No households found" description={search ? 'Try another name, address or code.' : 'No households are available in this ward yet.'} />
          : <ul className="worker-list">
            {filtered.map((household) => (
              <li key={household.qrCode}>
                <button className="worker-list-row worker-household-row" type="button" onClick={() => openDetails(household)}>
                  <span className="worker-household-row__top">
                    <span className="worker-list-row__primary">{household.ownerName}</span>
                    <Badge variant="neutral">{household.type === 'commercial' ? 'Commercial' : 'Residential'}</Badge>
                  </span>
                  <span className="worker-list-row__secondary">{household.address}</span>
                  <span className="worker-household-card__code">{household.qrCode}</span>
                </button>
              </li>
            ))}
          </ul>}
      </div>

      {registerOpen && (
        <BottomSheet title="Register household" onClose={() => setRegisterOpen(false)}>
          <form className="worker-stack" onSubmit={register}>
            <div className="worker-field">
              <label htmlFor="register-owner">Owner name</label>
              <input id="register-owner" required maxLength={120} value={form.ownerName} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} />
            </div>
            <div className="worker-field">
              <label htmlFor="register-phone">Phone</label>
              <input id="register-phone" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} required value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} />
              <span className="worker-help">10-digit Indian mobile number</span>
            </div>
            <div className="worker-field">
              <label htmlFor="register-address">Address</label>
              <textarea id="register-address" required maxLength={255} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            </div>
            <fieldset className="worker-type-fieldset">
              <legend>Type</legend>
              <label><input type="radio" name="household-type" value="residential" checked={form.type === 'residential'} onChange={() => setForm((current) => ({ ...current, type: 'residential' }))} /> Residential</label>
              <label><input type="radio" name="household-type" value="commercial" checked={form.type === 'commercial'} onChange={() => setForm((current) => ({ ...current, type: 'commercial' }))} /> Commercial</label>
            </fieldset>
            {error && <p className="worker-error" role="alert">{error}</p>}
            <Button className="worker-touch-button" type="submit" disabled={!isOnline || saving}>
              {saving ? 'Registering…' : 'Register household'}
            </Button>
          </form>
        </BottomSheet>
      )}

      {registered && (
        <BottomSheet title="Household registered" onClose={() => setRegistered(null)}>
          <div className="worker-qr-preview">
            <QRCodeSVG value={registered.qrCode} size={240} level="M" includeMargin aria-label={`QR code for ${registered.ownerName}`} />
            <p className="worker-household-card__code">{registered.qrCode}</p>
            <p className="worker-list-row__primary">{registered.ownerName}</p>
            <p className="worker-list-row__secondary">{registered.address}</p>
            <Button className="worker-touch-button" onClick={() => printHousehold(registered)}>Print label</Button>
          </div>
        </BottomSheet>
      )}

      {selected && (
        <BottomSheet title={selected.ownerName} className="worker-household-sheet" onClose={() => { setSelected(null); setError(''); }}>
          {detailLoading ? <Spinner label="Loading household" /> : <>
            <div className="worker-qr-preview">
              <QRCodeSVG value={selected.qrCode} size={220} level="M" includeMargin aria-label={`QR code for ${selected.ownerName}`} />
              <p className="worker-household-card__code">{selected.qrCode}</p>
            </div>
            <div className="worker-household-card__details">
              <p>{selected.address}</p>
              <p>{selected.type === 'commercial' ? 'Commercial' : 'Residential'}</p>
            </div>
            <h3 className="worker-subheading">Recent pickups</h3>
            {selected.pickupLogs?.length
              ? <ul className="worker-detail-logs">
                {selected.pickupLogs.slice(0, 5).map((log) => (
                  <li key={log.id}><StatusBadge status={log.status} /><time dateTime={log.loggedAt}>{new Date(log.loggedAt).toLocaleString()}</time>{log.reason && <span>{log.reason}</span>}</li>
                ))}
              </ul>
              : <p className="worker-help">No recent pickup history is available offline.</p>}
            {error && <p className="worker-error">{error}</p>}
            <Button className="worker-touch-button" variant="secondary" onClick={() => printHousehold(selected)}>Print label</Button>
          </>}
        </BottomSheet>
      )}
    </section>
  );
}