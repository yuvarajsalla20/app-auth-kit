import type { SupabaseClient, User } from '@supabase/supabase-js';
import { coded } from '../errors';
import type { NativeProviders } from '../providerTypes';
import { unwrap } from './errors';

/**
 * Which sign-in methods the current person uses, and sign-in with the phone's sheets.
 * Supabase names them `email`, `google` and `apple`.
 */
export const createSupabaseProviders = (client: SupabaseClient | null, native: NativeProviders, currentUser: () => User | null) => {
  const cancelled = () => coded('cancelled', 'auth/cancelled');
  const hasProvider = (id: string): boolean => {
    const user = currentUser();
    if (!user) return false;
    const listed = (user.app_metadata?.providers as string[] | undefined) ?? [];
    return listed.includes(id) || !!user.identities?.some((i) => i.provider === id);
  };
  const hasPassword = (): boolean => hasProvider('email');
  const requireClient = (): SupabaseClient => {
    if (!client) throw new Error('Supabase is not configured.');
    return client;
  };
  return {
    hasProvider,
    hasPassword,
    // Same rule as the Firebase kit: Apple wins when linked, because only its sheet gives the code needed to revoke.
    usesApple: (): boolean => !!native.apple && hasProvider('apple'),
    /** Signs in with Google's sheet. */
    google: async () => {
      const idToken = await native.google!();
      if (!idToken) throw cancelled();
      return unwrap(requireClient().auth.signInWithIdToken({ provider: 'google', token: idToken }));
    },
    /** Signs in with Apple's sheet, and hands back Apple's authorization code (for revoking on delete). */
    apple: async () => {
      const result = await native.apple!();
      if (!result) throw cancelled();
      const data = await unwrap(requireClient().auth.signInWithIdToken({ provider: 'apple', token: result.idToken, nonce: result.rawNonce }));
      return { data, code: result.authorizationCode };
    },
  };
};
export type SupabaseProviders = ReturnType<typeof createSupabaseProviders>;
