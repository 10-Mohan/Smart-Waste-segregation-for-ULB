import { useEffect, useState } from 'react';
import api from '../services/api.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Section from '../components/ui/Section.jsx';
import './Home.css';

function SystemStatus() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    let active = true;
    api.get('/health')
      .then(() => { if (active) setStatus('online'); })
      .catch(() => { if (active) setStatus('offline'); });
    return () => { active = false; };
  }, []);

  const variant = status === 'online' ? 'good' : status === 'offline' ? 'bad' : 'neutral';
  const label = status === 'online' ? 'System operational' : status === 'offline' ? 'System unavailable' : 'Checking system';
  return <Badge className="system-status" variant={variant}><span aria-hidden="true" className={`system-status__dot is-${status}`} />{label}</Badge>;
}

export default function Home() {
  useDocumentTitle('Home');
  return (
    <Section className="home-launcher">
      <div className="home-launcher__content">
        <p className="eyebrow">QR-based waste collection</p>
        <h1>Scan. Log. Track.</h1>
        <p className="home-launcher__subtitle">Workers log each pickup in seconds. Households see how they are doing.</p>
        <div className="home-launcher__cards">
          <Card className="home-launcher__card">
            <p className="home-launcher__card-kicker">Collection worker</p>
            <h2>I'm a collection worker</h2>
            <p>Record a household pickup and its segregation status.</p>
            <Button to="/worker">Open worker view</Button>
          </Card>
          <Card className="home-launcher__card">
            <p className="home-launcher__card-kicker">Household</p>
            <h2>I'm a household</h2>
            <p>Check your recent collection status.</p>
            <Button to="/citizen" variant="secondary">Open citizen view</Button>
          </Card>
        </div>
        <SystemStatus />
      </div>
    </Section>
  );
}