import useDocumentTitle from '../hooks/useDocumentTitle.js';
import WorkerApp from './worker/WorkerApp.jsx';

export default function Worker() {
  useDocumentTitle('Worker App');
  return <WorkerApp />;
}