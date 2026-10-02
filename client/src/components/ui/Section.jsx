import Container from './Container.jsx';
import './Section.css';

export default function Section({ as: Element = 'section', tinted = false, className = '', children, ...props }) {
  return (
    <Element className={`ui-section${tinted ? ' ui-section--tinted' : ''} ${className}`.trim()} {...props}>
      <Container>{children}</Container>
    </Element>
  );
}