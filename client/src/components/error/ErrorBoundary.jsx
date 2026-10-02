import { Component } from 'react';
import Button from '../ui/Button.jsx';
import Container from '../ui/Container.jsx';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container className="ui-empty-state">
          <h2>Something went wrong.</h2>
          <p>We're sorry, but an unexpected error occurred.</p>
          <Button type="button" onClick={() => window.location.reload()}>Reload the page</Button>
        </Container>
      );
    }

    return this.props.children;
  }
}
