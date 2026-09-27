// SHARED SCAFFOLDING - NOT owned by the Demand vertical.
// Created by Sathurstiga S. (IT24103156) so the demand routes are reachable and the
// pages sit in a realistic management shell. The web owners replace this with the
// router and layouts on integration.
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import DevSignIn from './features/auth/DevSignIn';
import ConsumptionAnalytics from './features/demand/ConsumptionAnalytics';
import ForecastPage from './features/demand/ForecastPage';
import ShortageDashboard from './features/demand/ShortageDashboard';
import ShortageDetail from './features/demand/ShortageDetail';
import ShortageForm from './features/demand/ShortageForm';
import { useAuth } from './hooks/useAuth';
import { ROLE_LABELS } from './services/authApi';

const DEMAND_LINKS = [
  { to: '/demand/shortages', label: 'Shortages' },
  { to: '/demand/forecasts', label: 'Forecasts' },
  { to: '/demand/consumption', label: 'Consumption' },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden="true">
            MS
          </span>
          MediStock
        </div>

        <div>
          <p className="sidebar__section">Demand &amp; Shortage</p>
          <nav className="sidebar__nav" aria-label="Demand">
            {DEMAND_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className="sidebar__link">
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <p className="sidebar__footer">Management console</p>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__context">
            <span className="topbar__facility">Hospital B</span>
            <span className="topbar__meta">Demand &amp; Shortage vertical</span>
          </div>

          {session && (
            <div className="topbar__session">
              <span className="topbar__role">{ROLE_LABELS[session.role]}</span>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  navigate('/sign-in', { replace: true });
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<DevSignIn />} />

      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Shell>
              <Routes>
                <Route path="/" element={<Navigate to="/demand/shortages" replace />} />
                <Route path="/demand/shortages" element={<ShortageDashboard />} />
                {/* Static segments before the :id route, so /new is not read as an id. */}
                <Route path="/demand/shortages/new" element={<ShortageForm />} />
                <Route path="/demand/shortages/:id/edit" element={<ShortageForm />} />
                <Route path="/demand/shortages/:id" element={<ShortageDetail />} />
                <Route path="/demand/forecasts" element={<ForecastPage />} />
                <Route path="/demand/consumption" element={<ConsumptionAnalytics />} />
              </Routes>
            </Shell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
