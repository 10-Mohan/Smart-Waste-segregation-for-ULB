import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Container from '../components/ui/Container.jsx';
import './AppLayout.css';

const roleLabels = { worker: 'Worker', supervisor: 'Supervisor', ulb_admin: 'ULB administrator' };

export default function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-layout">
      <header className="app-toolbar">
        <Container className="app-toolbar__inner">
          <Link className="app-toolbar__brand" to="/">Waste Monitoring</Link>
          <div className="app-toolbar__account">
            <span className="app-toolbar__name">{user?.name}</span>
            <Badge variant="neutral">{roleLabels[user?.role] || user?.role}</Badge>
            <Button variant="ghost" size="sm" onClick={logout}>Logout</Button>
          </div>
        </Container>
      </header>
      <main className="app-layout__main" id="main"><Outlet /></main>
    </div>
  );
}