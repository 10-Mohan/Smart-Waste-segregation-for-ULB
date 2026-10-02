import useDocumentTitle from '../hooks/useDocumentTitle.js';
import Section from '../components/ui/Section.jsx';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import Button from '../components/ui/Button.jsx';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <Section>
      <SectionHeader eyebrow="404" title="Page not found" lead="This address is not available." />
      <Button to="/">Return home</Button>
    </Section>
  );
}