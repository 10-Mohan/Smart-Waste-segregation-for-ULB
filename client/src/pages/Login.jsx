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

function routeForRole(role) {
  if (role === 'worker') return '/worker';
  if (role === 'supervisor' || role === 'ulb_admin') return '/dashboard';
  return '/';
}

export default function Login() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useDocumentTitle('Login');

  useEffect(() => {
    if (!authLoading && user) {
      navigate(location.state?.from?.pathname || routeForRole(user.role), { replace: true });
    }
  }, [authLoading, location.state, navigate, user]);

  function fillDemo(account) {
    setEmail(account.email);
    setPassword('Demo@1234');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const signedInUser = await login(email.trim(), password);
      const destination = location.state?.from?.pathname || routeForRole(signedInUser.role);
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Unable to sign in. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (user) {
    return null; // Will redirect in useEffect
  }

  return (
    <Container className="login-page">
      <SectionHeader eyebrow="Secure access" title="Sign in to your workspace" lead="Use your assigned account to access field or ward tools." />
      <div className="login-grid">
        <Card className="login-form-card">
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="login-email">Email address</label>
            <input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <p className="login-form__error" role="alert">{error}</p>}
            <Button type="submit" disabled={submitting || authLoading}>
              {submitting ? <Spinner size="sm" label="Signing in" /> : 'Sign in'}
            </Button>
          </form>
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