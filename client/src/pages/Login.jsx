import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Container from '../components/ui/Container.jsx';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import './Login.css';

const demos = [
  { role: 'Worker', email: 'worker@demo.in' },
  { role: 'Supervisor', email: 'supervisor@demo.in' },
  { role: 'Admin', email: 'admin@demo.in' }
];

const phoneEnabled = import.meta.env.DEV || import.meta.env.VITE_PHONE_OTP === 'true';
const RESEND_SECONDS = 60;

function routeForRole(role) {
  if (role === 'worker') return '/worker';
  if (role === 'supervisor' || role === 'ulb_admin') return '/dashboard';
  return '/';
}

function messageFrom(requestError, fallback) {
  return requestError.response?.data?.error?.message || fallback;
}

function destinationFor(role, fromPath) {
  const home = routeForRole(role);
  if (!fromPath || fromPath === '/login') return home;
  if (fromPath.startsWith('/worker') && role !== 'worker') return home;
  if (fromPath.startsWith('/dashboard') && role === 'worker') return home;
  return fromPath;
}

export default function Login() {
  const { login, loginWithCode, requestCode, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('code');
  const [channel, setChannel] = useState('email');
  const [step, setStep] = useState('enter');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useDocumentTitle('Login');

  useEffect(() => {
    if (!authLoading && user) {
      navigate(destinationFor(user.role, location.state?.from?.pathname), { replace: true });
    }
  }, [authLoading, location.state, navigate, user]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function chooseChannel(next) {
    setChannel(next);
    setStep('enter');
    setIdentifier('');
    setCode('');
    setError('');
    setInfo('');
  }

  function fillDemo(account) {
    setMode('password');
    setEmail(account.email);
    setPassword('Demo@1234');
    setError('');
  }

  function finishSignIn(signedInUser) {
    navigate(destinationFor(signedInUser.role, location.state?.from?.pathname), { replace: true });
  }

  async function sendCode(event) {
    event?.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      await requestCode(channel, identifier.trim());
      setStep('verify');
      setCode('');
      setCooldown(RESEND_SECONDS);
      setInfo(channel === 'email'
        ? 'If this email is registered, a 6-digit code has been sent. It is valid for 5 minutes.'
        : 'If this number is registered, a 6-digit code has been sent. It is valid for 5 minutes.');
    } catch (requestError) {
      setError(messageFrom(requestError, 'Unable to send the code. Check your connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      finishSignIn(await loginWithCode(channel, identifier.trim(), code.trim()));
    } catch (requestError) {
      setError(messageFrom(requestError, 'Unable to sign in. Check your connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      finishSignIn(await login(email.trim(), password));
    } catch (requestError) {
      setError(messageFrom(requestError, 'Unable to sign in. Check your connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (user) {
    return null; // Will redirect in useEffect
  }

  return (
    <Container className="login-page">
      <SectionHeader eyebrow="Secure access" title="Sign in to your workspace" lead="We will send a one-time code to your registered email or phone." />
      <div className="login-grid">
        <Card className="login-form-card">
          {mode === 'code' ? (
            <>
            {phoneEnabled && (
            <div className="login-tabs" role="tablist" aria-label="Sign-in method">
                  ... the same two buttons as before ...
                </div>
              )}

              {channel === 'phone' && !phoneEnabled ? (
                <p className="login-form__note">SMS sign-in is coming soon. Please use your email for now.</p>
              ) : step === 'enter' ? (
                <form className="login-form" onSubmit={sendCode}>
                  <label htmlFor="login-identifier">{channel === 'email' ? 'Email address' : 'Mobile number'}</label>
                  <input
                    id="login-identifier"
                    name="identifier"
                    type={channel === 'email' ? 'email' : 'tel'}
                    inputMode={channel === 'email' ? 'email' : 'numeric'}
                    autoComplete={channel === 'email' ? 'email' : 'tel'}
                    placeholder={channel === 'email' ? 'you@example.com' : '10-digit mobile number'}
                    required
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                  {error && <p className="login-form__error" role="alert">{error}</p>}
                  <Button type="submit" disabled={submitting || authLoading}>
                    {submitting ? <Spinner size="sm" label="Sending code" /> : 'Send code'}
                  </Button>
                </form>
              ) : (
                <form className="login-form" onSubmit={verifyCode}>
                  {info && <p className="login-form__note" role="status">{info}</p>}
                  <label htmlFor="login-code">6-digit code</label>
                  <input
                    id="login-code"
                    name="code"
                    className="login-code-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  />
                  {error && <p className="login-form__error" role="alert">{error}</p>}
                  <Button type="submit" disabled={submitting || code.length !== 6}>
                    {submitting ? <Spinner size="sm" label="Signing in" /> : 'Verify and sign in'}
                  </Button>
                  <div className="login-form__links">
                    <button type="button" className="login-link" disabled={cooldown > 0 || submitting} onClick={sendCode}>
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    </button>
                    <button type="button" className="login-link" onClick={() => { setStep('enter'); setError(''); setInfo(''); }}>
                      Change {channel === 'email' ? 'email' : 'number'}
                    </button>
                  </div>
                </form>
              )}
              <button type="button" className="login-link login-link--block" onClick={() => { setMode('password'); setError(''); }}>
                Use password instead
              </button>
            </>
          ) : (
            <>
              <form className="login-form" onSubmit={submitPassword}>
                <label htmlFor="login-email">Email address</label>
                <input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
                <label htmlFor="login-password">Password</label>
                <input id="login-password" name="password" type="password" autoComplete="current-password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
                {error && <p className="login-form__error" role="alert">{error}</p>}
                <Button type="submit" disabled={submitting || authLoading}>
                  {submitting ? <Spinner size="sm" label="Signing in" /> : 'Sign in'}
                </Button>
              </form>
              <button type="button" className="login-link login-link--block" onClick={() => { setMode('code'); setError(''); }}>
                Use a one-time code instead
              </button>
            </>
          )}
        </Card>
        {import.meta.env.DEV && (
          <aside className="demo-panel" aria-labelledby="demo-heading">
            <div className="demo-panel__heading">
              <h2 id="demo-heading">Demo accounts</h2>
              <Badge variant="warn">Demo only</Badge>
            </div>
            <p className="demo-panel__note">These shared credentials are for demonstration only.</p>
            <ul className="demo-list">
              {demos.map((account) => (
                <li key={account.email}>
                  <div><p>{account.role}</p><code>{account.email}</code></div>
                  <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo(account)}>Use account</Button>
                </li>
              ))}
            </ul>
            <p className="demo-panel__password">Password: <code>Demo@1234</code></p>
          </aside>
        )}
      </div>
    </Container>
  );
}