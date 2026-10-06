import { useState, useMemo } from 'react';
import Card from '../../components/ui/Card.jsx';

function groupIntoWeeks(dailyData) {
  if (!dailyData || !dailyData.length) return [];
  const weeks = [];
  let currentWeek = null;
  
  for (const day of dailyData) {
    const d = new Date(day.period);
    // JS getDay(): 0 is Sunday, 1 is Monday.
    // Assuming week starts on Monday, or let's just group every 7 items if lazy, but real grouping is better.
    // Let's use ISO week or just a simple week start.
    const startOfWeek = new Date(d);
    startOfWeek.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday start
    const weekKey = startOfWeek.toISOString().slice(0, 10);
    
    if (!currentWeek || currentWeek.period !== weekKey) {
      if (currentWeek) weeks.push(currentWeek);
      currentWeek = { period: weekKey, totalPickups: 0, segregated: 0, mixed: 0, rejected: 0 };
    }
    currentWeek.totalPickups += day.totalPickups;
    currentWeek.segregated += day.segregated;
    currentWeek.mixed += day.mixed;
    currentWeek.rejected += day.rejected;
  }
  if (currentWeek) weeks.push(currentWeek);
  
  return weeks.map(w => {
    const valid = w.segregated + w.mixed + w.rejected;
    const compliancePercent = valid > 0 ? Math.round((w.segregated / valid) * 1000) / 10 : 0;
    return { ...w, compliancePercent };
  });
}

export default function TrendChart({ data, loading }) {
  const [granularity, setGranularity] = useState('day');

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return granularity === 'week' ? groupIntoWeeks(data.data) : data.data;
  }, [data, granularity]);

  if (loading && !data) return null;

  const points = chartData.length;
  const maxCompliance = 100;

  // Simple SVG mapping
  const width = 600;
  const height = 200;
  const paddingX = 40;
  const paddingY = 20;

  const getX = (index) => paddingX + (index * (width - 2 * paddingX) / Math.max(1, points - 1));
  const getY = (value) => height - paddingY - (value / maxCompliance) * (height - 2 * paddingY);

  const pathD = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.compliancePercent)}`).join(' ');

  return (
    <Card className="dashboard-widget trend-chart-widget">
      <div className="widget-header">
        <h3>Compliance Trend</h3>
        <div className="toggle-group" role="group" aria-label="Granularity toggle">
          <button aria-pressed={granularity === 'day'} onClick={() => setGranularity('day')}>Day</button>
          <button aria-pressed={granularity === 'week'} onClick={() => setGranularity('week')}>Week</button>
        </div>
      </div>
      
      {chartData.length === 0 ? (
        <p>No data available for this period.</p>
      ) : (
        <>
          <div className="svg-chart-container" aria-hidden="true">
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
              {/* Axes */}
              <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#ccc" />
              <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#ccc" />
              
              {/* Path */}
              {pathD && <path d={pathD} fill="none" stroke="var(--color-primary, #0056b3)" strokeWidth="3" />}
              
              {/* Points */}
              {chartData.map((d, i) => (
                <circle 
                  key={d.period} 
                  cx={getX(i)} 
                  cy={getY(d.compliancePercent)} 
                  r="4" 
                  fill="var(--color-primary, #0056b3)"
                >
                  <title>{`${d.period}: ${d.compliancePercent}%`}</title>
                </circle>
              ))}
            </svg>
            <div className="chart-labels x-axis">
              <span>{chartData[0]?.period}</span>
              <span>{chartData[chartData.length - 1]?.period}</span>
            </div>
          </div>
          
          <div className="sr-only">
            <table>
              <caption>Compliance Trend Data</caption>
              <thead>
                <tr><th>Period</th><th>Compliance %</th><th>Pickups</th></tr>
              </thead>
              <tbody>
                {chartData.map(d => (
                  <tr key={d.period}>
                    <td>{d.period}</td>
                    <td>{d.compliancePercent}%</td>
                    <td>{d.totalPickups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
