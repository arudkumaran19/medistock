/**
 * SHARED - session state. Primary owner: Vaisnavi L. (IT24102469).
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156) so the
 * protected demand pages are reachable. Replace with the owner's implementation.
 */
import { createContext, useContext } from 'react';
import type { Session, UserRole } from '@/services/authApi';

export const SESSION_STORAGE_KEY = 'medistock.session';
export const TOKEN_STORAGE_KEY = 'medistock.accessToken';

export interface AuthContextValue {
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }

  return context;
}

/** Reads the stored session, discarding one that has already expired. */
export function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as Session;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      clearStoredSession();
      return null;
    }

    return session;
  } catch {
    // Private windows and cleared site data both throw here.
    return null;
  }
}

export function writeStoredSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    // The API client reads the bare token.
    localStorage.setItem(TOKEN_STORAGE_KEY, session.accessToken);
  } catch {
    // Storage unavailable: the session still works for this page load.
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function hasRole(session: Session | null, roles: UserRole[]): boolean {
  return session !== null && roles.includes(session.role);
}
