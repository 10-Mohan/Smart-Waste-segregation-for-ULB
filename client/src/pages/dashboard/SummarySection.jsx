import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';

export default function SummarySection({ data, loading }) {
  if (loading && !data) return null; // Wait for first load
  if (!data) return <p>No data available</p>;

  return (
    <div className="dashboard-summary">
      <Card className="summary-card">
        <h3>Total Households</h3>
        <p className="summary-card__value">{data.totalHouseholds}</p>
        <p className="summary-card__sub">{data.activeHouseholds} active</p>
      </Card>
      
      <Card className="summary-card">
        <h3>Pickups Logged</h3>
        <p className="summary-card__value">{data.totalPickups}</p>
        <div className="summary-card__trend">
          <TrendIndicator change={data.changeVsPreviousPeriod.totalPickups} />
          <span>vs previous period</span>
        </div>
        <div className="summary-card__counts">
          <Badge variant="good">S: {data.segregated}</Badge>
          <Badge variant="warning">M: {data.mixed}</Badge>
          <Badge variant="bad">R: {data.rejected}</Badge>
        </div>
      </Card>

      <Card className="summary-card summary-card--highlight">
        <h3>Compliance</h3>
        <p className="summary-card__value">{data.compliancePercent}%</p>
        <div className="summary-card__trend">
          <TrendIndicator change={data.changeVsPreviousPeriod.compliancePercent} suffix="%" />
          <span>vs previous period</span>
        </div>
      </Card>
    </div>
  );
}

function TrendIndicator({ change, suffix = '' }) {
  if (change > 0) {
    return <span className="trend-up" aria-label={`Increased by ${change}${suffix}`}>↑ {change}{suffix}</span>;
  }
  if (change < 0) {
    return <span className="trend-down" aria-label={`Decreased by ${Math.abs(change)}${suffix}`}>↓ {Math.abs(change)}{suffix}</span>;
  }
  return <span className="trend-flat" aria-label="No change">—</span>;
}
