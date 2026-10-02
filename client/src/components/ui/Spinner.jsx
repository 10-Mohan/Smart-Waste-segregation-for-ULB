import './Spinner.css';

export default function Spinner({ label = 'Loading', size = 'md' }) {
  return (
    <span className={`ui-spinner ui-spinner--${size}`} role="status" aria-label={label}>
      <span className="ui-spinner__ring" aria-hidden="true" />
      <span className="ui-spinner__label">{label}</span>
    </span>
  );
}