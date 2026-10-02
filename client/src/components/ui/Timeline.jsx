import './Timeline.css';

export default function Timeline({ items, className = '' }) {
  return (
    <ol className={`ui-timeline ${className}`.trim()}>
      {items.map((item, index) => (
        <li className="ui-timeline__item" key={item.id ?? `${item.title}-${index}`}>
          <span className="ui-timeline__marker" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div className="ui-timeline__content">
            {item.date && <p className="ui-timeline__date">{item.date}</p>}
            <h3>{item.title}</h3>
            {item.description && <p>{item.description}</p>}
            {item.status && <span className="ui-timeline__status">{item.status}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}