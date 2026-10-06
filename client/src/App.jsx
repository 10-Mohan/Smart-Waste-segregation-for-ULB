import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Spinner from './components/ui/Spinner.jsx';
import RouteEffects from './components/RouteEffects.jsx';
import ErrorBoundary from './components/error/ErrorBoundary.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Citizen = lazy(() => import('./pages/citizen/Citizen.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Worker = lazy(() => import('./pages/Worker.jsx'));
const WorkerLabels = lazy(() => import('./pages/worker/LabelsPage.jsx'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function PageFallback() {
  return <div className="route-loading"><Spinner label="Loading page" /></div>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouteEffects />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="citizen" element={<Citizen />} />
            <Route path="login" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route element={<ProtectedRoute roles={['worker']}><AppLayout /></ProtectedRoute>}>
            <Route path="/worker" element={<Worker />} />
            <Route path="/worker/labels" element={<WorkerLabels />} />
          </Route>
          <Route element={<ProtectedRoute roles={['supervisor', 'ulb_admin']}><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}