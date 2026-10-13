import { useState, useMemo, useEffect } from 'react';
import Card from '../../components/ui/Card.jsx';

function groupIntoWeeks(dailyData) {
  if (!dailyData || !dailyData.length) return [];
  const weeks = [];
  let currentWeek = null;
  
  for (const day of dailyData) {
    const d = new Date(day.period);
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

export default function TrendChart({ data, loading, defaultGranularity = 'day' }) {
  const [granularity, setGranularity] = useState(defaultGranularity);

  useEffect(() => {
    if (defaultGranularity) {
      setGranularity(defaultGranularity);
    }
  }, [defaultGranularity]);

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return granularity === 'week' ? groupIntoWeeks(data.data) : data.data;
  }, [data, granularity]);

  if (loading && !data) return null;

  const points = chartData.length;
  const maxCompliance = 100;

  const width = 600;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const getX = (index) => paddingLeft + (index * (width - paddingLeft - paddingRight) / Math.max(1, points - 1));
  const getY = (value) => height - paddingBottom - (value / maxCompliance) * (height - paddingTop - paddingBottom);

  // Build path with gaps: break line on days with no pickups
  const pathD = useMemo(() => {
    let d = '';
    let inSegment = false;
    chartData.forEach((item, i) => {
      if (item.totalPickups > 0) {
        const x = getX(i);
        const y = getY(item.compliancePercent);
        if (!inSegment) {
          d += `M ${x} ${y} `;
          inSegment = true;
        } else {
          d += `L ${x} ${y} `;
        }
      } else {
        inSegment = false;
      }
    });
    return d.trim();
  }, [chartData, points]);

  const yTicks = [0, 25, 50, 75, 100];

  const xTicks = useMemo(() => {
    if (points === 0) return [];
    if (points <= 6) {
      return chartData.map((d, i) => ({ index: i, label: d.period }));
    }
    const count = 5;
    const step = (points - 1) / (count - 1);
    const result = [];
    for (let k = 0; k < count; k++) {
      const idx = Math.min(points - 1, Math.round(k * step));
      if (!result.some(r => r.index === idx)) {
        result.push({ index: idx, label: chartData[idx].period });
      }
    }
    return result;
  }, [chartData, points]);

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
          <div className="svg-chart-container" style={{ position: 'relative' }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              height="100%"
              style={{ display: 'block', overflow: 'visible' }}
              role="img"
              aria-label="Compliance trend chart"
            >
              {/* Y-axis gridlines and labels */}
              {yTicks.map(val => {
                const y = getY(val);
                return (
                  <g key={val}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      stroke={val === 0 ? '#bbb' : '#e2e8f0'}
                      strokeDasharray={val === 0 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="10"
                      fill="#666"
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* Y-axis line */}
              <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={paddingLeft}
                y2={height - paddingBottom}
                stroke="#bbb"
                strokeWidth="1"
              />

              {/* X-axis tick marks and labels */}
              {xTicks.map(t => {
                const x = getX(t.index);
                let anchor = 'middle';
                if (t.index === 0) anchor = 'start';
                else if (t.index === points - 1) anchor = 'end';
                return (
                  <g key={t.index}>
                    <line
                      x1={x}
                      y1={height - paddingBottom}
                      x2={x}
                      y2={height - paddingBottom + 5}
                      stroke="#bbb"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={height - paddingBottom + 18}
                      textAnchor={anchor}
                      fontSize="10"
                      fill="#666"
                    >
                      {t.label}
                    </text>
                  </g>
                );
              })}
              
              {/* Trend Path with gaps */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--color-primary, #0056b3)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              
              {/* Points: only rendered when totalPickups > 0 */}
              {chartData.map((d, i) => {
                if (d.totalPickups === 0) return null;
                const tooltipText = `${d.period}: ${d.compliancePercent}% (${d.segregated}/${d.totalPickups} pickups)`;
                return (
                  <circle 
                    key={d.period} 
                    cx={getX(i)} 
                    cy={getY(d.compliancePercent)} 
                    r="4" 
                    fill="var(--color-primary, #0056b3)"
                    tabIndex={0}
                    role="graphics-symbol"
                    aria-label={tooltipText}
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{tooltipText}</title>
                  </circle>
                );
              })}
            </svg>
          </div>
          
          <div className="sr-only">
            <table>
              <caption>Compliance Trend Data</caption>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Compliance %</th>
                  <th>Total Pickups</th>
                  <th>Segregated</th>
                  <th>Mixed</th>
                  <th>Rejected</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(d => (
                  <tr key={d.period}>
                    <td>{d.period}</td>
                    <td>{d.compliancePercent}%</td>
                    <td>{d.totalPickups}</td>
                    <td>{d.segregated}</td>
                    <td>{d.mixed}</td>
                    <td>{d.rejected}</td>
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
