import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';

function LevelBadge({ level }) {
  if (level === 'good') return <Badge variant="good"><span aria-hidden="true">✓ </span>Good</Badge>;
  if (level === 'moderate') return <Badge variant="warning"><span aria-hidden="true">! </span>Moderate</Badge>;
  return <Badge variant="bad"><span aria-hidden="true">× </span>Poor</Badge>;
}

export default function WardComparison({ data, loading }) {
  if (loading && !data) return null;
  if (!data || data.length === 0) return <Card><h3>Ward Comparison</h3><p>No data available</p></Card>;

  return (
    <Card className="dashboard-widget ward-comparison">
      <h3>Ward Comparison</h3>
      <div className="ward-comparison__list">
        {data.map((ward) => (
          <div key={ward.wardId} className="ward-row">
            <div className="ward-row__header">
              <span className="ward-row__name">{ward.wardName}</span>
              <LevelBadge level={ward.level} />
            </div>
            <div className="ward-row__bar-container" aria-hidden="true">
              <div 
                className={`ward-row__bar level-${ward.level}`} 
                style={{ width: `${ward.compliancePercent}%` }} 
              />
            </div>
            <div className="ward-row__stats">
              <span>{ward.compliancePercent}% Compliance</span>
              <span>{ward.pickups} Pickups</span>
              <span className="sr-only">Level: {ward.level}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
