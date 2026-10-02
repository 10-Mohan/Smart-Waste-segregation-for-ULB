import './SectionHeader.css';

export default function SectionHeader({ eyebrow, title, lead, align = 'left', as: Heading = 'h2', className = '' }) {
  return (
    <header className={`ui-section-header ui-section-header--${align} ${className}`.trim()}>
      {eyebrow && <p className="ui-section-header__eyebrow">{eyebrow}</p>}
      <Heading>{title}</Heading>
      {lead && <p className="ui-section-header__lead">{lead}</p>}
    </header>
  );
}