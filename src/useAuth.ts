import { onAuthStateChanged, type Auth } from 'firebase/auth';
import { useEffect, useState } from 'react';
import type { AuthState } from './types';

/** Reports the sign-in state. Not configured, or turned off, counts as signed out so the app never waits forever. Returns the unsubscribe. */
export const subscribeAuth = (auth: Auth | null, enabled: boolean, set: (state: AuthState) => void, onError?: (where: string, error: unknown) => void): (() => void) | undefined => {
  if (!enabled || !auth) {
    set({ status: 'out' });
    return undefined;
  }
  return onAuthStateChanged(
    auth,
    (user) => set(user ? { status: 'in', user } : { status: 'out' }),
    (error) => {
      set({ status: 'out' });
      onError?.('auth-state', error);
    },
  );
};

/** Who is signed in. `loading` lasts only until Firebase has restored the saved sign-in. */
export const createUseAuth = (auth: Auth | null, onError?: (where: string, error: unknown) => void) => (enabled = true): AuthState => {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  useEffect(() => subscribeAuth(auth, enabled, setState, onError), [enabled]);
  return state;
};
