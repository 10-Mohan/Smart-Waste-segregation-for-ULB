import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../../components/ui/Button.jsx';
import Container from '../../components/ui/Container.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import useDocumentTitle from '../../hooks/useDocumentTitle.js';
import { downloadHouseholds, listCachedHouseholds } from '../../services/workerHouseholds.js';
import { getPrintablePayload } from '../../services/workerHouseholds.js';
import './worker.css';
import './labels.css';

export default function LabelsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useDocumentTitle('Household labels');

  useEffect(() => {
    let active = true;
    async function load() {
      let households;
      try {
        households = await downloadHouseholds(user?.wardId);
      } catch {
        households = await listCachedHouseholds(user?.wardId);
      }
      const requestedCode = new URLSearchParams(location.search).get('code');
      if (requestedCode) households = households.filter((household) => household.qrCode === requestedCode);
      const printable = await Promise.all(households.map(async (household) => {
        if (!navigator.onLine || !household.id) return {
          qrCode: household.qrCode,
          ownerName: household.ownerName,
          address: household.address,
          wardName: household.ward?.name || '',
        };
        try {
          return await getPrintablePayload(household);
        } catch {
          return {
            qrCode: household.qrCode,
            ownerName: household.ownerName,
            address: household.address,
            wardName: household.ward?.name || '',
          };
        }
      }));
      if (active) setLabels(printable);
      if (active) setLoading(false);
    }
    load().catch(() => {
      if (active) setError('Labels could not be loaded. Return to Households and try again.');
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [location.search, user?.wardId]);

  return (
    <div className="worker-labels">
      <Container>
        <div className="worker-labels__controls no-print">
          <Button variant="ghost" onClick={() => navigate('/worker')}>Back to worker view</Button>
          <Button onClick={() => window.print()} disabled={!labels.length}>Print labels</Button>
        </div>
        {loading
          ? <Spinner label="Preparing labels" />
          : error
            ? <p className="worker-error">{error}</p>
            : labels.length
              ? <div className="worker-label-grid">
                {labels.map((label) => (
                  <article className="worker-print-label" key={label.qrCode}>
                    <QRCodeSVG value={label.qrCode} size={120} level="M" includeMargin aria-label={`QR code ${label.qrCode}`} />
                    <p className="worker-print-label__code">{label.qrCode}</p>
                    <p className="worker-print-label__owner">{label.ownerName}</p>
                    <p className="worker-print-label__address">{label.address}</p>
                    {label.wardName && <p className="worker-print-label__ward">{label.wardName}</p>}
                  </article>
                ))}
              </div>
              : <EmptyState title="No labels to print" description="Register a household to create its QR label." />}
      </Container>
    </div>
  );
}