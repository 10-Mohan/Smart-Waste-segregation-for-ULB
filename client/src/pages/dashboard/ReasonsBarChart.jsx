import Card from '../../components/ui/Card.jsx';

export default function ReasonsBarChart({ data, loading }) {
  if (loading && !data) return null;
  if (!data || data.length === 0) {
    return <Card className="dashboard-widget reasons-chart"><h3>Rejection Reasons</h3><p>No rejected pickups in this period.</p></Card>;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barHeight = 32;
  const gap = 16;
  const paddingY = 20;
  const height = paddingY * 2 + data.length * (barHeight + gap) - gap;
  
  return (
    <Card className="dashboard-widget reasons-chart">
      <h3>Rejection Reasons</h3>
      <div className="svg-chart-container" aria-hidden="true" style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 400 ${height}`} width="100%" height={height}>
          {data.map((d, i) => {
            const y = paddingY + i * (barHeight + gap);
            const width = (d.count / maxCount) * 300;
            return (
              <g key={d.reason} transform={`translate(0, ${y})`}>
                <text x="0" y="14" fontSize="12" fill="var(--text-primary, #333)">{d.reason}</text>
                <rect x="0" y="20" width={Math.max(width, 2)} height="12" fill="var(--color-bad, #9a3028)" rx="2" />
                <text x={Math.max(width, 2) + 8} y="30" fontSize="12" fill="var(--text-secondary, #666)" fontWeight="bold">
                  {d.count}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="sr-only">
        <table>
          <caption>Rejection Reasons Breakdown</caption>
          <thead><tr><th>Reason</th><th>Count</th></tr></thead>
          <tbody>
            {data.map(d => (
              <tr key={d.reason}><td>{d.reason}</td><td>{d.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
