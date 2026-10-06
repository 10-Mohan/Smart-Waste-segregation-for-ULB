import Card from '../../components/ui/Card.jsx';

export default function Hotspots({ data, loading }) {
  if (loading && !data) return null;
  
  return (
    <Card className="dashboard-widget hotspots">
      <h3>Repeat Offenders (Hotspots)</h3>
      {!data || data.length === 0 ? (
        <p>No hotspots identified in this period.</p>
      ) : (
        <div className="table-responsive" tabIndex={0} role="region" aria-label="Repeat offenders table">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Household</th>
                <th>Owner</th>
                <th>Ward</th>
                <th>Violations</th>
                <th>Most Common Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.map((h, i) => (
                <tr key={h.householdId}>
                  <td>#{i + 1}</td>
                  <td><span style={{ whiteSpace: 'nowrap' }}>{h.householdCode}</span></td>
                  <td>{h.ownerName.split(' ')[0]}</td>
                  <td>{h.wardCode}</td>
                  <td style={{ fontWeight: 'bold' }}>{h.count}</td>
                  <td>{h.mostCommonReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
