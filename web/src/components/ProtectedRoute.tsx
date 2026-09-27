/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011),
 * consuming the session owned by Vaisnavi L. (IT24102469).
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, hasRole } from '@/hooks/useAuth';
import type { UserRole } from '@/services/authApi';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  if (roles && !hasRole(session, roles)) {
    return (
      <div className="state state--error" role="alert">
        <p>Your role does not have access to this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
