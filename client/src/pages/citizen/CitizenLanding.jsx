import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import QrCameraScanner from '../../components/QrCameraScanner.jsx';
import RegistrationForm from './RegistrationForm.jsx';
import { downloadQr, printCitizenQr, QrLabel } from './CitizenQrSheet.jsx';
import './citizen.css';

function statusError(error) {
  if (error.response?.status === 429) return 'Too many tries. Please wait a few minutes and try again.';
  if (!error.response) return "Can't reach the server right now.";
  return "We couldn't match those details. Check the code on your bin and your phone digits.";
}

function IHaveCode({ initialCode, initialError, onVerify }) {
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [last4, setLast4] = useState('');
  const [error, setError] = useState(initialError);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => { setCode(initialCode.trim().toUpperCase()); }, [initialCode]);
  useEffect(() => { setError(initialError); }, [initialError]);

  async function submit(event) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError('Enter the household code on your bin.');
      return;
    }
    if (!/^\d{4}$/.test(last4)) {
      setError('Enter the last 4 digits of your phone number.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const verified = await onVerify(normalizedCode, last4);
      if (verified !== true) setError(typeof verified === 'string' ? verified : "We couldn't match those details. Check the code on your bin and your phone digits.");
    } catch (requestError) {
      setError(statusError(requestError));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card className="citizen-access-card">
      <form className="citizen-form" onSubmit={submit} noValidate>
        <div className="citizen-field">
          <label htmlFor="citizen-code">Household code</label>
          <input ref={codeRef} id="citizen-code" autoCapitalize="characters" autoComplete="off" placeholder="HH-W01-001" value={code} aria-invalid={Boolean(error)} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(''); }} />
        </div>
        <div className="citizen-field">
          <label htmlFor="citizen-last4">Last 4 digits of phone</label>
          <input id="citizen-last4" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={last4} aria-invalid={Boolean(error)} onChange={(event) => { setLast4(event.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} />
        </div>
        {error && <p className="citizen-error" role="alert">{error}</p>}
        <Button className="citizen-touch-button" type="submit" disabled={verifying}>
          {verifying ? <Spinner size="sm" label="Checking" /> : 'Check status'}
        </Button>
      </form>
      <Button className="citizen-touch-button citizen-scan-button" type="button" variant="secondary" onClick={() => setScannerOpen((open) => !open)}>
        {scannerOpen ? 'Close scanner' : 'Scan the QR on my bin'}
      </Button>
      {scannerOpen && <QrCameraScanner startLabel="Start scanner" onScan={(scannedCode) => { setCode(scannedCode); setError(''); setScannerOpen(false); codeRef.current?.focus(); }} />}
      <p className="citizen-help">Lost your code? Ask your collection worker - they can look up your household.</p>
    </Card>
  );
}

function RegistrationSuccess({ registration, phoneLast4, onOpenDashboard }) {
  const canvasRef = useRef(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  async function openDashboard() {
    setOpening(true);
    setError('');
    const verified = await onOpenDashboard(registration.qrCode, phoneLast4);
    if (verified !== true) setError(typeof verified === 'string' ? verified : "We couldn't match those details. Check the code on your bin and your phone digits.");
    setOpening(false);
  }

  return (
    <Card className="citizen-registration-success">
      <span className="citizen-success-mark" aria-hidden="true">✓</span>
      <SectionHeader as="h1" eyebrow="Household registered" title="You're registered!" lead="Your household QR code is ready." />
      <div className="citizen-print-label citizen-qr-preview">
        <QrLabel code={registration.qrCode} firstName={registration.ownerFirstName} wardName={registration.wardName} canvasRef={canvasRef} />
      </div>
      <p className="citizen-success-instruction">Stick this on your bin. Your collection worker will scan it at every pickup.</p>
      <p className="citizen-success-reminder">Remember the last 4 digits of your phone number - you'll need them to check your status.</p>
      {error && <p className="citizen-error" role="alert">{error}</p>}
      <div className="citizen-success-actions no-print">
        <Button className="citizen-touch-button" variant="secondary" onClick={() => downloadQr(canvasRef, registration.qrCode)}>Download QR</Button>
        <Button className="citizen-touch-button" variant="secondary" onClick={printCitizenQr}>Print label</Button>
        <Button className="citizen-touch-button" disabled={opening} onClick={openDashboard}>
          {opening ? <Spinner size="sm" label="Opening dashboard" /> : 'Open my dashboard'}
        </Button>
      </div>
    </Card>
  );
}

export default function CitizenLanding({ initialCode = '', initialError = '', initialTab, onVerify }) {
  const [tab, setTab] = useState(() => initialTab || (initialCode ? 'code' : 'register'));
  const [registration, setRegistration] = useState(null);
  const [phoneLast4, setPhoneLast4] = useState('');

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    } else if (initialCode) {
      setTab('code');
    }
  }, [initialTab, initialCode]);

  if (registration) {
    return <RegistrationSuccess registration={registration} phoneLast4={phoneLast4} onOpenDashboard={onVerify} />;
  }

  const tabs = [
    { id: 'code', label: 'I have a code', content: <IHaveCode initialCode={initialCode} initialError={initialError} onVerify={onVerify} /> },
    {
      id: 'register',
      label: 'Register my household',
      content: <RegistrationForm onSuccess={(result, last4) => { setRegistration(result); setPhoneLast4(last4); }} />,
    },
  ];

  return (
    <div className="citizen-landing">
      <SectionHeader as="h1" eyebrow="Citizen" title="Your collection, at a glance" lead="Check your household or register the code on your bin." />
      <Tabs label="Citizen access" items={tabs} defaultTab={tab} onChange={setTab} />
    </div>
  );
}