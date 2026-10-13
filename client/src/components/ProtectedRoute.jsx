import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './ui/Spinner.jsx';
import Section from './ui/Section.jsx';
import SectionHeader from './ui/SectionHeader.jsx';
import Button from './ui/Button.jsx';
import { getRoleHome } from '../utils/navigation.js';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <div className="route-loading"><Spinner label="Restoring session" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    const handleLogout = () => {
      logout();
      navigate('/login', { replace: true });
    };

    return (
      <Section>
        <SectionHeader
          eyebrow="Access restricted"
          title="This area is not available to your account"
          lead="Your account does not have permission to view this workspace. Head over to your page or sign out to use a different account."
        />
        <div style={{ display: 'flex', gap: 'var(--space-3, 0.75rem)', marginTop: 'var(--space-4, 1.5rem)', flexWrap: 'wrap' }}>
          <Button to={getRoleHome(user.role)}>Go to my page</Button>
          <Button type="button" variant="secondary" onClick={handleLogout}>Log out</Button>
        </div>
      </Section>
    );
  }
  return children;
}