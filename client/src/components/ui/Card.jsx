import './Card.css';

export default function Card({ as: Element = 'article', className = '', children, ...props }) {
  return <Element className={`ui-card ${className}`.trim()} {...props}>{children}</Element>;
}