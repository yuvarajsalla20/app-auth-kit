import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { SupabaseAuthState } from './types';

/** Reports the sign-in state. Not configured, turned off, or a failed listener counts as signed out, so the app never waits forever. Returns the unsubscribe. */
export const subscribeSupabaseAuth = (
  client: SupabaseClient | null,
  enabled: boolean,
  set: (state: SupabaseAuthState) => void,
  onError?: (where: string, error: unknown) => void,
): (() => void) | undefined => {
  if (!enabled || !client) {
    set({ status: 'out' });
    return undefined;
  }
  try {
    // Supabase sends INITIAL_SESSION first (the saved sign-in, or none), then every change.
    const { data } = client.auth.onAuthStateChange((_event, session) => set(session?.user ? { status: 'in', user: session.user } : { status: 'out' }));
    return () => data.subscription.unsubscribe();
  } catch (error) {
    set({ status: 'out' });
    onError?.('auth-state', error);
    return undefined;
  }
};

/** Who is signed in. `loading` lasts only until Supabase has restored the saved sign-in. */
export const createUseSupabaseAuth = (client: SupabaseClient | null, onError?: (where: string, error: unknown) => void) => (enabled = true): SupabaseAuthState => {
  const [state, setState] = useState<SupabaseAuthState>({ status: 'loading' });
  useEffect(() => subscribeSupabaseAuth(client, enabled, setState, onError), [enabled]);
  return state;
};
