import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import Spinner from '../../components/ui/Spinner.jsx';
import './EngagementFunnel.css';

const COLUMN = 100;
const MAX_HALF = 30; // widest band uses 60% of the chart height, leaving room for the numbers

/** Smooth tapered band: flat in the middle of each column, curving between columns. */
function bandPath(stages, scale) {
  const n = stages.length;
  const width = COLUMN * n;
  const centres = stages.map((_, i) => COLUMN * i + COLUMN / 2);
  const half = stages.map((stage) => Math.max(0.8, (stage.percentOfTotal / 100) * MAX_HALF * scale));
  const top = half.map((h) => 50 - h);
  const bottom = half.map((h) => 50 + h);
  const mid = COLUMN / 2;

  let d = `M 0 ${top[0]} L ${centres[0]} ${top[0]}`;
  for (let i = 0; i < n - 1; i += 1) {
    d += ` C ${centres[i] + mid} ${top[i]}, ${centres[i + 1] - mid} ${top[i + 1]}, ${centres[i + 1]} ${top[i + 1]}`;
  }
  d += ` L ${width} ${top[n - 1]} L ${width} ${bottom[n - 1]} L ${centres[n - 1]} ${bottom[n - 1]}`;
  for (let i = n - 1; i > 0; i -= 1) {
    d += ` C ${centres[i] - mid} ${bottom[i]}, ${centres[i - 1] + mid} ${bottom[i - 1]}, ${centres[i - 1]} ${bottom[i - 1]}`;
  }
  return `${d} L 0 ${bottom[0]} Z`;
}

export default function EngagementFunnel({ wardId }) {
  const [stages, setStages] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setStages(null);
    setError(false);
    api.get('/dashboard/funnel/engagement', { params: wardId ? { wardId } : {} })
      .then(({ data }) => { if (active) setStages(data.stages); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [wardId]);

  return (
    <section className="engagement-funnel" aria-labelledby="engagement-funnel-heading">
      <header className="engagement-funnel__header">
        <h2 id="engagement-funnel-heading">Citizen engagement</h2>
        <p>How far households have come. Each stage counts only households that also passed the stage before it. Snapshot as of today.</p>
      </header>

      {error ? (
        <p className="engagement-funnel__message" role="alert">Unable to load the engagement funnel.</p>
      ) : !stages ? (
        <div className="engagement-funnel__message"><Spinner label="Loading engagement funnel" /></div>
      ) : stages[0].count === 0 ? (
        <p className="engagement-funnel__message">No registered households yet.</p>
      ) : (
        <>
          <div className="engagement-funnel__chart">
            <svg
              key={stages.map((stage) => stage.count).join('-')}
              className="engagement-funnel__bands"
              viewBox={`0 0 ${COLUMN * stages.length} 100`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path className="engagement-funnel__halo" d={bandPath(stages, 1.2)} />
              <path className="engagement-funnel__band" d={bandPath(stages, 1)} />
            </svg>
            <ol className="engagement-funnel__stages">
              {stages.map((stage, index) => (
                <li className="engagement-funnel__stage" key={stage.id}>
                  <span className="engagement-funnel__count">{stage.count.toLocaleString()}</span>
                  <span className="engagement-funnel__chip">{Math.round(stage.percentOfTotal)}%</span>
                  <span className="engagement-funnel__label">{stage.label}</span>
                  <span className="engagement-funnel__drop">
                    {index === 0 ? 'All active households' : `${Math.round(stage.percentOfPrevious)}% of previous stage`}
                  </span>
                  <span className="engagement-funnel__bar" style={{ width: `${Math.max(stage.percentOfTotal, 1)}%` }} aria-hidden="true" />
                </li>
              ))}
            </ol>
          </div>
          <table className="sr-only">
            <caption>Citizen engagement funnel</caption>
            <thead><tr><th>Stage</th><th>Households</th><th>Share of registered</th></tr></thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id}><td>{stage.label}</td><td>{stage.count}</td><td>{stage.percentOfTotal}%</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}