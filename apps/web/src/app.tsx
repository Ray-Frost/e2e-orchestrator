import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './app.css';
import { FailureStatisticsPage } from './failure-statistics-page';
import {
  failureStatisticsRoute,
  runsRoute,
  suitesRoute,
} from './operator-navigation';
import { RunDetailPage, runDetailRoutePattern } from './run-detail-page';
import { RunsPage } from './runs-page';
import { SuitesPage } from './suites-page';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate replace to={suitesRoute} />} />
        <Route path={suitesRoute} element={<SuitesPage />} />
        <Route path={runsRoute} element={<RunsPage />} />
        <Route
          path={failureStatisticsRoute}
          element={<FailureStatisticsPage />}
        />
        <Route path={runDetailRoutePattern} element={<RunDetailPage />} />
        <Route path="*" element={<Navigate replace to={suitesRoute} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
