/**
 * TEMPORARY DEVELOPMENT SIGN-IN. DELETE ON INTEGRATION.
 *
 * Authentication is owned by Vaisnavi L. (IT24102469). Her real sign-in - email and
 * password, Identity users, refresh tokens - replaces this screen entirely.
 *
 * This exists so the Demand pages, which are all [Authorize]-protected, can actually
 * be opened and demonstrated before Auth lands. It asks only which role to act as, and
 * the endpoint behind it refuses to run outside the Development environment.
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { toErrorMessage } from '@/services/apiClient';
import { ROLE_LABELS, requestDevToken, type UserRole } from '@/services/authApi';
import { useAuth } from '@/hooks/useAuth';

const ROLE_BLURB: Record<UserRole, string> = {
  FACILITY_MANAGER: 'Monitor shortages, generate forecasts, approve responses.',
  STORE_OFFICER: 'Record consumption in the field and view alerts.',
  ADMIN: 'Full access across every facility.',
  SUPPLIER_OFFICER: 'Suppliers, purchase orders and deliveries.',
};

const ROLES: UserRole[] = ['FACILITY_MANAGER', 'STORE_OFFICER', 'ADMIN', 'SUPPLIER_OFFICER'];

export function DevSignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [pending, setPending] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/demand/shortages';

  async function choose(role: UserRole) {
    setPending(role);
    setError(null);

    try {
      signIn(await requestDevToken(role));
      navigate(from, { replace: true });
    } catch (cause) {
      setError(toErrorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="signin">
      <div className="signin__panel">
        <div className="signin__brand">
          <span className="sidebar__mark" aria-hidden="true">
            MS
          </span>
          <div>
            <h1 className="signin__title">MediStock</h1>
            <p className="signin__subtitle">Medicine inventory and supply coordination</p>
          </div>
        </div>

        <div className="signin__notice" role="note">
          <strong>Development sign-in.</strong> Real authentication is not built yet, so
          choose a role to continue. No password is checked.
        </div>

        <h2 className="signin__prompt">Continue as</h2>

        <div className="signin__roles">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className="role-card"
              disabled={pending !== null}
              onClick={() => choose(role)}
            >
              <span className="role-card__name">{ROLE_LABELS[role]}</span>
              <span className="role-card__blurb">{ROLE_BLURB[role]}</span>
              {pending === role && <span className="role-card__pending">Signing in…</span>}
            </button>
          ))}
        </div>

        {error && <ErrorState message={error} />}

        <p className="signin__hint">
          The Demand &amp; Shortage pages need Facility Manager or Administrator to
          generate forecasts.
        </p>
      </div>
    </div>
  );
}

export default DevSignIn;
