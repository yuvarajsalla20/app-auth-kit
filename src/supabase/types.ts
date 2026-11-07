import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NativeProviders } from '../providerTypes';

export type { AppleResult, NativeProviders } from '../providerTypes';

export type SupabaseAuthState = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: User };

export interface SupabaseAuthKitOptions {
  /** The app's own Supabase client (`createClient(url, anonKey, { auth: { storage, ... } })`), or null while the app has no Supabase settings. */
  supabase: SupabaseClient | null;
  /** Show "Continue with Google" through Supabase's web redirect (web only). On phones pass `native.google` instead. */
  google?: boolean;
  /** Show "Sign in with Apple" through Supabase's web redirect (web only; needs an Apple Services ID in Supabase). On iPhone pass `native.apple` instead. */
  apple?: boolean;
  /** Phone sign-in sheets for Apple and Google. A provider left out is hidden. */
  native?: NativeProviders;
  /** Shortest password accepted at sign-up and when changing it. Match the minimum set in the Supabase dashboard. */
  minPassword?: number;
  /** Longest nickname kept. */
  maxNickname?: number;
  /** Called with a place name and the error when something fails quietly (for example, Apple's token revoke), so the app can report it. */
  onError?: (where: string, error: unknown) => void;
  /** Extra or replacement error texts, by error code (the same `auth/...` codes as the Firebase kit). */
  messages?: Record<string, string>;
  /** How long deleting an account may take before it gives up (ms). */
  deleteTimeoutMs?: number;
  /** Shortest gap between two reset emails to the same address (ms). */
  resetCooldownMs?: number;
  /** Where the password-reset email link opens (a deep link such as `myapp://reset`, or a web page). Must be in Supabase's allowed redirect URLs. */
  resetRedirectTo?: string;
  /** Where Supabase sends the browser back after web Google sign-in. */
  oauthRedirectTo?: string;
  /**
   * Removes the login on the server. A browser cannot delete a Supabase user itself.
   * Default: calls the database function named by `deleteRpc` (see the README for the SQL).
   */
  deleteUser?: () => Promise<void>;
  /** Name of the database function the default `deleteUser` calls. Default `delete_user`. */
  deleteRpc?: string;
  /**
   * Revokes Sign in with Apple when the account is deleted (Apple requires it). Needs Apple's client secret, so it must run
   * on a server (for example a Supabase Edge Function). Gets the authorization code from Apple's sheet. A failure is reported, not thrown.
   */
  revokeApple?: (authorizationCode: string) => Promise<void>;
}
