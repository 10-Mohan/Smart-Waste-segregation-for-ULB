import './Container.css';

export default function Container({ as: Element = 'div', className = '', children, ...props }) {
  return <Element className={`ui-container ${className}`.trim()} {...props}>{children}</Element>;
}