import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { requestCitizenCode, requestLinkCode, verifyCitizenCode, verifyLinkCode } from '../../services/citizenService.js';
import './citizen.css';

const RESEND_SECONDS = 60;
const phoneEnabled = import.meta.env.DEV || import.meta.env.VITE_PHONE_OTP === 'true';

function apiMessage(error, fallback) {
  if (!error.response) return "Can't reach the server right now.";
  return error.response.data?.error?.message || fallback;
}

function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, () => setSeconds(RESEND_SECONDS)];
}

function CodeStep({ info, code, setCode, error, submitting, cooldown, onSubmit, onResend, onBack, backLabel }) {
  return (
    <form className="citizen-form" onSubmit={onSubmit} noValidate>
      {info && <p className="citizen-help" role="status">{info}</p>}
      <div className="citizen-field">
        <label htmlFor="citizen-otp">6-digit code</label>
        <input
          id="citizen-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          aria-invalid={Boolean(error)}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
      {error && <p className="citizen-error" role="alert">{error}</p>}
      <Button className="citizen-touch-button" type="submit" disabled={submitting || code.length !== 6}>
        {submitting ? <Spinner size="sm" label="Checking" /> : 'Verify and continue'}
      </Button>
      <Button className="citizen-touch-button" type="button" variant="secondary" disabled={cooldown > 0 || submitting} onClick={onResend}>
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </Button>
      <Button className="citizen-touch-button" type="button" variant="secondary" onClick={onBack}>{backLabel}</Button>
    </form>
  );
}

export function SignInWithCode({ initialError = '', onSession }) {
  const [channel, setChannel] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState('enter');
  const [code, setCode] = useState('');
  const [error, setError] = useState(initialError);
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, startCooldown] = useCooldown();

  useEffect(() => { setError(initialError); }, [initialError]);

  function chooseChannel(next) {
    setChannel(next);
    setStep('enter');
    setIdentifier('');
    setCode('');
    setError('');
    setInfo('');
  }

  async function send(event) {
    event?.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await requestCitizenCode(channel, identifier.trim());
      setStep('verify');
      setCode('');
      startCooldown();
      setInfo(`If this ${channel === 'email' ? 'email' : 'number'} is registered, a 6-digit code has been sent. It is valid for 5 minutes.`);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Unable to send the code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await verifyCitizenCode(channel, identifier.trim(), code);
      const outcome = await onSession(result);
      if (outcome !== true) setError(typeof outcome === 'string' ? outcome : 'Unable to sign in. Please try again.');
    } catch (requestError) {
      setError(apiMessage(requestError, 'Unable to sign in. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="citizen-access-card">
            {phoneEnabled && (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <Button type="button" size="sm" variant={channel === 'email' ? undefined : 'secondary'} onClick={() => chooseChannel('email')}>Email</Button>
          <Button type="button" size="sm" variant={channel === 'phone' ? undefined : 'secondary'} onClick={() => chooseChannel('phone')}>Phone</Button>
        </div>
      )}
      {channel === 'phone' && !phoneEnabled ? (
        <p className="citizen-help">SMS sign-in is coming soon. Please use your email.</p>
      ) : step === 'enter' ? (
        <form className="citizen-form" onSubmit={send} noValidate>
          <div className="citizen-field">
            <label htmlFor="citizen-identifier">{channel === 'email' ? 'Email address' : 'Mobile number'}</label>
            <input
              id="citizen-identifier"
              type={channel === 'email' ? 'email' : 'tel'}
              inputMode={channel === 'email' ? 'email' : 'numeric'}
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              placeholder={channel === 'email' ? 'you@example.com' : '10-digit mobile number'}
              value={identifier}
              aria-invalid={Boolean(error)}
              onChange={(event) => { setIdentifier(event.target.value); setError(''); }}
            />
          </div>
          {error && <p className="citizen-error" role="alert">{error}</p>}
          <Button className="citizen-touch-button" type="submit" disabled={submitting || !identifier.trim()}>
            {submitting ? <Spinner size="sm" label="Sending code" /> : 'Send code'}
          </Button>
        </form>
      ) : (
        <CodeStep
          info={info} code={code} setCode={setCode} error={error} submitting={submitting} cooldown={cooldown}
          onSubmit={verify} onResend={send}
          onBack={() => { setStep('enter'); setError(''); setInfo(''); }}
          backLabel={`Change ${channel === 'email' ? 'email' : 'number'}`}
        />
      )}
      <p className="citizen-help">First time signing in with email? Use the "First time here?" tab to link your household once.</p>
    </Card>
  );
}

export function LinkHousehold({ initialCode = '', onSession }) {
  const [qrCode, setQrCode] = useState(initialCode.trim().toUpperCase());
  const [last4, setLast4] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('enter');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, startCooldown] = useCooldown();

  useEffect(() => { setQrCode(initialCode.trim().toUpperCase()); }, [initialCode]);

  async function send(event) {
    event?.preventDefault();
    if (!qrCode.trim()) { setError('Enter the household code on your bin.'); return; }
    if (!/^\d{4}$/.test(last4)) { setError('Enter the last 4 digits of your phone number.'); return; }
    if (!email.trim()) { setError('Enter the email you want to use.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await requestLinkCode(qrCode.trim().toUpperCase(), last4, email.trim());
      setStep('verify');
      setCode('');
      startCooldown();
      setInfo('We sent a 6-digit code to that email. It is valid for 5 minutes.');
    } catch (requestError) {
      setError(apiMessage(requestError, "We couldn't match those details. Check the code on your bin and your phone digits."));
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await verifyLinkCode(qrCode.trim().toUpperCase(), last4, email.trim(), code);
      const outcome = await onSession(result);
      if (outcome !== true) setError(typeof outcome === 'string' ? outcome : 'Unable to continue. Please try again.');
    } catch (requestError) {
      setError(apiMessage(requestError, 'Unable to continue. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="citizen-access-card">
      {step === 'enter' ? (
        <form className="citizen-form" onSubmit={send} noValidate>
          <p className="citizen-help">Do this once. Confirm your household, add your email, and from then on you can sign in with just an emailed code.</p>
          <div className="citizen-field">
            <label htmlFor="link-code">Household code</label>
            <input id="link-code" autoCapitalize="characters" autoComplete="off" placeholder="HH-W01-001" value={qrCode} onChange={(event) => { setQrCode(event.target.value.toUpperCase()); setError(''); }} />
          </div>
          <div className="citizen-field">
            <label htmlFor="link-last4">Last 4 digits of phone</label>
            <input id="link-last4" inputMode="numeric" autoComplete="off" maxLength={4} value={last4} onChange={(event) => { setLast4(event.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} />
          </div>
          <div className="citizen-field">
            <label htmlFor="link-email">Your email address</label>
            <input id="link-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} />
          </div>
          {error && <p className="citizen-error" role="alert">{error}</p>}
          <Button className="citizen-touch-button" type="submit" disabled={submitting}>
            {submitting ? <Spinner size="sm" label="Sending code" /> : 'Send code to my email'}
          </Button>
        </form>
      ) : (
        <CodeStep
          info={info} code={code} setCode={setCode} error={error} submitting={submitting} cooldown={cooldown}
          onSubmit={verify} onResend={send}
          onBack={() => { setStep('enter'); setError(''); setInfo(''); }}
          backLabel="Change details"
        />
      )}
    </Card>
  );
}