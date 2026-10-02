import './EmptyState.css';

export default function EmptyState({ title, description, action, className = '' }) {
  return (
    <div className={`ui-empty-state ${className}`.trim()} role="status">
      <span className="ui-empty-state__mark" aria-hidden="true">—</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}