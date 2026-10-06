import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { fetchDashboardViolations } from '../../services/dashboard.js';
import Spinner from '../../components/ui/Spinner.jsx';

export default function ViolationsLog({ initialData, filters }) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Sync initialData if it changes from top-level filter refresh
  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  async function loadPage(newPage) {
    if (newPage < 1 || !data?.pagination) return;
    if (newPage > Math.ceil(data.pagination.total / data.pagination.limit)) return;
    
    setLoading(true);
    try {
      const res = await fetchDashboardViolations({ ...filters, page: newPage });
      setData(res);
      setPage(newPage);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!data) return null;

  const { violations = [], pagination } = data;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;

  return (
    <Card className="dashboard-widget violations-log">
      <h3>Violations Log</h3>
      {violations.length === 0 ? (
        <p>No violations logged in this period.</p>
      ) : (
        <>
          <div className="table-responsive" tabIndex={0} role="region" aria-label="Violations log table" style={{ position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner label="Loading page..." />
              </div>
            )}
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Household</th>
                  <th>Ward</th>
                  <th>Worker</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {violations.map(v => (
                  <tr key={v.id}>
                    <td>{new Date(v.loggedAt).toLocaleString()}</td>
                    <td>{v.household?.qrCode || `HH-${v.householdId}`}</td>
                    <td>{v.household?.ward?.code}</td>
                    <td>{v.worker?.name}</td>
                    <td>{v.reason || 'Unspecified'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {pagination && pagination.total > pagination.limit && (
            <div className="pagination-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
              <Button variant="secondary" size="sm" onClick={() => loadPage(page - 1)} disabled={page <= 1 || loading}>
                Previous
              </Button>
              <span>Page {page} of {totalPages} (Total: {pagination.total})</span>
              <Button variant="secondary" size="sm" onClick={() => loadPage(page + 1)} disabled={page >= totalPages || loading}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
