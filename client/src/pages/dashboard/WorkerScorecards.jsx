import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import Card from '../../components/ui/Card.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value));
}

export default function WorkerScorecards({ wardId }) {
  const [workers, setWorkers] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/ratings/scorecards', { params: wardId ? { wardId } : {} })
      .then(({ data }) => {
        if (cancelled) return;
        setWorkers(data.workers || []);
        setError(false);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [wardId]);

  return (
    <Card>
      <h3>Worker scorecards</h3>
      <p className="summary-card__sub">Citizen ratings and this week's workload for each collection worker.</p>
      {error && <p>Could not load worker scorecards right now.</p>}
      {!error && workers === null && <Spinner label="Loading worker scorecards" />}
      {!error && workers && workers.length === 0 && <p>No workers found for this selection.</p>}
      {!error && workers && workers.length > 0 && (
        <div style={{ display: 'grid', gap: '16px', marginTop: '12px' }}>
          {workers.map((worker) => (
            <div key={worker.workerId} style={{ borderTop: '1px solid #d8d8cf', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <strong>{worker.name}</strong>
                <span>
                  {worker.averageRating !== null
                    ? `${'\u2605'} ${worker.averageRating} / 5 (${worker.ratingsCount} ${worker.ratingsCount === 1 ? 'rating' : 'ratings'})`
                    : 'No ratings yet'}
                </span>
              </div>
              <p className="summary-card__sub">
                {worker.visitsThisWeek} visits this week - {worker.noOneHomeThisWeek} with no one home ({worker.noOneHomeRate}%)
              </p>
              {worker.recentReviews.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                  {worker.recentReviews.map((review, index) => (
                    <li key={`${review.date}-${index}`}>
                      {'\u2605'.repeat(review.stars)} {`"${review.comment}"`}
                      <span className="summary-card__sub">
                        {' '}- {review.household || 'Household'}, {formatDate(review.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}