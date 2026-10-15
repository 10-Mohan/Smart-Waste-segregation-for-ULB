import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import Container from '../components/ui/Container.jsx';
import './PublicLayout.css';

function Wordmark() {
  return (
    <Link className="public-nav__brand" to="/" aria-label="Waste Segregation Monitoring System home">
      <svg aria-hidden="true" viewBox="0 0 36 36" width="36" height="36">
        <path d="M18 3c8 4 12 10 11 18-1 7-6 11-13 12C9 31 4 26 5 19 6 12 11 7 18 3Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 25c5-6 9-10 16-14M13 22c0-4 2-7 6-9M16 26c4 0 7-2 9-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="public-nav__wordmark">Waste Segregation Monitoring</span>
    </Link>
  );
}

function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const location = useLocation();
  const { user, logout } = useAuth();
  const closeMenu = () => setMobileOpen(false);
  const signOut = () => { logout(); closeMenu(); };

  useEffect(() => {
    function handlePointerDown(event) {
      if (!navRef.current?.contains(event.target)) setMobileOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <header className="public-header" ref={navRef}>
      <Container className="public-nav__inner">
        <Wordmark />
        <button
          ref={toggleRef}
          className="public-nav__menu-toggle"
          type="button"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-menu"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen
            ? <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            : <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
        </button>
        <nav className="public-nav__desktop" aria-label="Main navigation">
          {(user?.role === 'supervisor' || user?.role === 'ulb_admin') && (
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'is-active' : ''}>Dashboard</NavLink>
          )}
          <NavLink to="/citizen" className={({ isActive }) => isActive ? 'is-active' : ''}>Citizen</NavLink>
          <NavLink to="/worker" className={({ isActive }) => isActive ? 'is-active' : ''}>Worker</NavLink>
          {user
            ? <Button type="button" size="sm" variant="secondary" onClick={signOut}>Logout</Button>
            : <Button to="/login" size="sm">Login</Button>}
        </nav>
      </Container>
      <div className={`public-nav__mobile-panel${mobileOpen ? ' is-open' : ''}`} id="public-mobile-menu" hidden={!mobileOpen}>
        <Container>
          <nav aria-label="Mobile navigation">
            {(user?.role === 'supervisor' || user?.role === 'ulb_admin') && (
              <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>
            )}
            <NavLink to="/citizen" onClick={closeMenu}>Citizen</NavLink>
            <NavLink to="/worker" onClick={closeMenu}>Worker</NavLink>
            {user
              ? <Button type="button" variant="secondary" onClick={signOut}>Logout</Button>
              : <Button to="/login" onClick={closeMenu}>Login</Button>}
          </nav>
        </Container>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="public-footer">
      <Container className="public-footer__inner">Waste Segregation Monitoring · {new Date().getFullYear()}</Container>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <a className="skip-link" href="#main">Skip to content</a>
      <Navigation />
      <main id="main"><Outlet /></main>
      <Footer />
    </div>
  );
}