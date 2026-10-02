import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './ui/Spinner.jsx';
import Section from './ui/Section.jsx';
import SectionHeader from './ui/SectionHeader.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="route-loading"><Spinner label="Restoring session" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <Section>
        <SectionHeader
          eyebrow="Access restricted"
          title="This area is not available to your account"
          lead="Your account role does not have permission to view this workspace. Return to the home page or sign in with an authorized account."
        />
      </Section>
    );
  }
  return children;
}