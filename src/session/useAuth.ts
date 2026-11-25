import { onAuthStateChanged, type Auth } from 'firebase/auth';
import { useEffect, useState } from 'react';
import type { UserMemory } from './rememberUser';
import type { AuthState } from '../types';

/**
 * Reports the sign-in state. Not configured, or turned off, counts as signed out so the app never waits forever. Returns the unsubscribe.
 * With a `memory`, a remembered person is reported at once as `{ status: 'in', confirming: true }`, before Firebase has refreshed the
 * login (one or two network calls at a cold start). Firebase's answer then replaces it: the same person (confirmed), nobody, or someone else.
 */
export const subscribeAuth = (
  auth: Auth | null,
  enabled: boolean,
  set: (state: AuthState) => void,
  onError?: (where: string, error: unknown) => void,
  memory?: UserMemory,
): (() => void) | undefined => {
  if (!enabled || !auth) {
    set({ status: 'out' });
    return undefined;
  }
  let answered = false;
  let stopped = false;
  if (memory) {
    const known = memory.peek();
    if (known) set({ status: 'in', user: known, confirming: true });
    else if (known === undefined)
      void memory.load().then((found) => {
        if (found && !answered && !stopped) set({ status: 'in', user: found, confirming: true });
      });
  }
  const stop = onAuthStateChanged(
    auth,
    (user) => {
      answered = true;
      if (user) memory?.remember(user);
      else memory?.forget();
      set(user ? { status: 'in', user } : { status: 'out' });
    },
    (error) => {
      answered = true;
      set({ status: 'out' });
      onError?.('auth-state', error);
    },
  );
  if (!memory) return stop;
  return () => {
    stopped = true;
    stop();
  };
};

/** The state before the first effect runs: the remembered person when already read, otherwise loading. */
const firstState = (auth: Auth | null, enabled: boolean, memory?: UserMemory): AuthState => {
  const known = enabled && auth ? memory?.peek() : undefined;
  return known ? { status: 'in', user: known, confirming: true } : { status: 'loading' };
};

// The remembered person reported again (the first render already had them) keeps the same state, so nothing renders twice.
const sameRemembered = (a: AuthState, b: AuthState) => a.status === 'in' && b.status === 'in' && !!a.confirming && !!b.confirming && a.user === b.user;

/**
 * Who is signed in. `loading` lasts only until Firebase has restored the saved sign-in, or, when the kit was given `storage`,
 * until the remembered person has been read (a few milliseconds); that person shows with `confirming: true` until Firebase answers.
 */
export const createUseAuth = (auth: Auth | null, onError?: (where: string, error: unknown) => void, memory?: UserMemory) => (enabled = true): AuthState => {
  const [state, setState] = useState<AuthState>(() => firstState(auth, enabled, memory));
  useEffect(() => subscribeAuth(auth, enabled, (next) => setState((prev) => (sameRemembered(prev, next) ? prev : next)), onError, memory), [enabled]);
  return state;
};
