import Card from '../../components/ui/Card.jsx';

export default function HeatGrid({ data, wards, loading }) {
  if (loading && (!data || data.length === 0)) return null;
  if (!data || data.length === 0) return null; // If supervisor, they might not see all wards heatmap, or maybe just 1 row.

  // Extract all unique weeks from the data
  const weekSet = new Set();
  data.forEach(wardTrend => {
    wardTrend.data?.forEach(d => weekSet.add(d.period));
  });
  
  const weeks = Array.from(weekSet).sort();
  
  if (weeks.length === 0) {
    return <Card className="dashboard-widget heat-grid"><h3>Ward Compliance Heatmap</h3><p>No data available.</p></Card>;
  }

  return (
    <Card className="dashboard-widget heat-grid">
      <h3>Ward Compliance Heatmap</h3>
      <div className="heat-grid-container" tabIndex={0} role="region" aria-label="Ward compliance heatmap table" style={{ overflowX: 'auto' }}>
        <table className="heat-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Ward</th>
              {weeks.map(w => (
                <th key={w} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(wardTrend => {
              const wardInfo = wards?.find(w => w.wardId === wardTrend.wardId);
              const name = wardInfo ? wardInfo.wardName : `Ward ${wardTrend.wardId}`;
              
              const periodMap = new Map();
              wardTrend.data?.forEach(d => periodMap.set(d.period, d.compliancePercent));
              
              return (
                <tr key={wardTrend.wardId}>
                  <td style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>{name}</td>
                  {weeks.map(w => {
                    const val = periodMap.get(w);
                    let color = '#eee';
                    let text = '-';
                    if (val !== undefined) {
                      text = `${val}%`;
                      if (val >= 70) color = 'var(--color-good, #23623f)';
                      else if (val >= 40) color = 'var(--color-warn, #754900)';
                      else color = 'var(--color-bad, #9a3028)';
                    }
                    return (
                      <td key={w} style={{ padding: '0.5rem' }}>
                        <div style={{
                          backgroundColor: val !== undefined ? color : 'transparent',
                          color: val !== undefined ? '#fff' : 'inherit',
                          padding: '0.25rem',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '0.875rem'
                        }}>
                          {text}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
