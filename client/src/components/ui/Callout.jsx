import './Callout.css';

export default function Callout({ variant = 'info', title, children, className = '' }) {
  return (
    <aside className={`ui-callout ui-callout--${variant} ${className}`.trim()} role={variant === 'warning' ? 'alert' : 'status'}>
      {title && <h3 className="ui-callout__title">{title}</h3>}
      <div>{children}</div>
    </aside>
  );
}