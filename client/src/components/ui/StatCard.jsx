import './StatCard.css';

export default function StatCard({ value, label, trend, note, className = '' }) {
  return (
    <article className={`ui-stat-card ${className}`.trim()}>
      <p className="ui-stat-card__value">{value}</p>
      <h3 className="ui-stat-card__label">{label}</h3>
      {trend && <p className="ui-stat-card__trend">{trend}</p>}
      {note && <p className="ui-stat-card__note">{note}</p>}
    </article>
  );
}