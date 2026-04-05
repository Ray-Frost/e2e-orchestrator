import { NavLink } from 'react-router-dom';

export const suitesRoute = '/suites';
export const runsRoute = '/runs';
export const failureStatisticsRoute = '/statistics/failures';

const operatorPages = [
  {
    label: 'Suites',
    end: true,
    to: suitesRoute,
  },
  {
    label: 'Runs',
    end: false,
    to: runsRoute,
  },
  {
    label: 'Failure statistics',
    end: true,
    to: failureStatisticsRoute,
  },
];

export function OperatorNavigation() {
  return (
    <nav aria-label="Operator pages" className="operator-nav">
      {operatorPages.map((operatorPage) => (
        <NavLink
          className={({ isActive }) =>
            isActive
              ? 'operator-nav-link operator-nav-link-active'
              : 'operator-nav-link'
          }
          end={operatorPage.end}
          key={operatorPage.to}
          to={operatorPage.to}
        >
          {operatorPage.label}
        </NavLink>
      ))}
    </nav>
  );
}
