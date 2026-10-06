import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import useDashboard from '../../hooks/useDashboard.js';
import { exportDashboardCsv } from '../../services/dashboard.js';
import useDocumentTitle from '../../hooks/useDocumentTitle.js';
import api, { SESSION_TOKEN_KEY } from '../../services/api.js';

import Container from '../../components/ui/Container.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

import SummarySection from './SummarySection.jsx';
import WardComparison from './WardComparison.jsx';
import TrendChart from './TrendChart.jsx';
import HeatGrid from './HeatGrid.jsx';
import Hotspots from './Hotspots.jsx';
import ViolationsLog from './ViolationsLog.jsx';
import ReasonsBarChart from './ReasonsBarChart.jsx';

import './Dashboard.css';

export default function Dashboard() {
  useDocumentTitle('ULB Dashboard');
  const { user } = useAuth();
  
  const [period, setPeriod] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [wardId, setWardId] = useState('');
  
  const [allWards, setAllWards] = useState([]);
  
  useEffect(() => {
    if (user?.role === 'ulb_admin') {
      api.get('/dashboard/wards').then(res => setAllWards(res.data.wards)).catch(console.error);
    }
  }, [user?.role]);

  const filters = useMemo(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    let from = '';
    
    if (period === '7d') {
      from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (period === '30d') {
      from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (period === '90d') {
      from = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (period === 'custom') {
      from = customFrom;
      const res = {};
      if (from) res.from = from;
      if (customTo) res.to = customTo;
      if (wardId) res.wardId = wardId;
      return res;
    }
    
    const res = { from, to };
    if (wardId) res.wardId = wardId;
    return res;
  }, [period, customFrom, customTo, wardId]);

  const { data, loading, error, refresh, lastRefreshed } = useDashboard(filters, { adminWards: user?.role === 'ulb_admin' ? allWards : [] });
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    try {
      setExporting(true);
      const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
      const { blob, filename } = await exportDashboardCsv(filters, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      // Need a toast here ideally, maybe alert for now if no toast context
    } catch (err) {
      console.error(err);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }

  const headingText = user?.role === 'supervisor' ? `ULB dashboard - ${user.ward?.name || 'Your Ward'}` : 'ULB dashboard - All wards';

  return (
    <Container className="dashboard-page">
      <div className="dashboard-header">
        <SectionHeader title={headingText} />
        
        <div className="dashboard-controls">
          <div className="dashboard-presets" role="group" aria-label="Date period presets">
            <button aria-pressed={period === '7d'} onClick={() => setPeriod('7d')}>Last 7 days</button>
            <button aria-pressed={period === '30d'} onClick={() => setPeriod('30d')}>Last 30 days</button>
            <button aria-pressed={period === '90d'} onClick={() => setPeriod('90d')}>Last 90 days</button>
            <button aria-pressed={period === 'custom'} onClick={() => setPeriod('custom')}>Custom</button>
          </div>
          
          {period === 'custom' && (
            <div className="dashboard-custom-dates">
              <label>From <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label>
              <label>To <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label>
            </div>
          )}

          {user?.role === 'ulb_admin' && (
            <div className="dashboard-ward-select">
              <label htmlFor="ward-select" className="sr-only">Select Ward</label>
              <select id="ward-select" value={wardId} onChange={e => setWardId(e.target.value)}>
                <option value="">All Wards</option>
                {allWards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          
          <div className="dashboard-actions">
            <span className="dashboard-last-updated" aria-live="polite">
              Updated {lastRefreshed ? lastRefreshed.toLocaleTimeString() : '...'}
            </span>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>Refresh</Button>
            <Button variant="primary" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="dashboard-error">
          <p>Unable to load dashboard data. Please try again.</p>
          <Button onClick={refresh}>Retry</Button>
        </div>
      ) : loading && !data.summary ? (
        <div className="dashboard-loading"><Spinner label="Loading dashboard..." /></div>
      ) : (
        <div className="dashboard-grid">
          <div className="dashboard-row summary-row">
            <SummarySection data={data.summary} loading={loading} />
          </div>
          
          <div className="dashboard-row two-col">
            <WardComparison data={data.wards} loading={loading} />
            <TrendChart data={data.trends} loading={loading} />
          </div>
          
          <div className="dashboard-row">
            <HeatGrid data={data.heatGrid} wards={data.wards} loading={loading} />
          </div>
          
          <div className="dashboard-row two-col">
            <Hotspots data={data.hotspots} loading={loading} />
            <ReasonsBarChart data={data.reasons} loading={loading} />
          </div>
          
          <div className="dashboard-row">
            <ViolationsLog initialData={data.violations} filters={filters} />
          </div>
        </div>
      )}
    </Container>
  );
}
