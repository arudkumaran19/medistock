/**
 * SHARED - session provider. Primary owner: Vaisnavi L. (IT24102469).
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 * Replace with the owner's implementation on integration.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@/services/authApi';
import {
  AuthContext,
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from '@/hooks/useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readStoredSession());

  const signIn = useCallback((next: Session) => {
    writeStoredSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
