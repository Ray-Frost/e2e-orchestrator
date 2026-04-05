import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './app.css';
import {
  FailureStatisticsPage,
  failureStatisticsRoute,
} from './failure-statistics-page';
import { RunDetailPage, runDetailRoutePattern } from './run-detail-page';
import { SuitesPage, suitesRoute } from './suites-page';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate replace to={suitesRoute} />} />
        <Route path={suitesRoute} element={<SuitesPage />} />
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
