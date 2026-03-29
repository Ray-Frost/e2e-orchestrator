import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useParams,
} from 'react-router-dom';
import './app.css';
import {
  FailureStatisticsPage,
  failureStatisticsRoute,
} from './failure-statistics-page';

function RunPlaceholderPage() {
  const routeParams = useParams();
  const runId = routeParams.id ?? 'unknown';

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="page-eyebrow">Runs</p>
        <h1>{`Run ${runId}`}</h1>
        <p className="page-summary">
          Placeholder route for future run details.
        </p>
      </header>
      <section className="status-panel">
        <p>Run details are not implemented yet.</p>
        <Link className="run-link" to={failureStatisticsRoute}>
          Back to failure statistics
        </Link>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate replace to={failureStatisticsRoute} />}
        />
        <Route
          path={failureStatisticsRoute}
          element={<FailureStatisticsPage />}
        />
        <Route path="/runs/:id" element={<RunPlaceholderPage />} />
        <Route
          path="*"
          element={<Navigate replace to={failureStatisticsRoute} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
