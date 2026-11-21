import type { Auth, User } from 'firebase/auth';
import type { AuthStorage, RememberedUser } from './rememberUser';

export type { AuthStorage, RememberedUser } from './rememberUser';

/**
 * The sign-in state. `confirming: true` means the person is the one this phone remembers, shown before Firebase has refreshed the
 * login; `user` then has the profile fields only (uid, email, displayName, photoURL, providerData ids), not Firebase's `User` methods.
 * Firebase's answer follows: the same person without `confirming`, `out`, or another person.
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; user: User; confirming?: false }
  | { status: 'in'; user: RememberedUser; confirming: true };

export type { AppleResult, NativeProviders } from './providerTypes';
import type { NativeProviders } from './providerTypes';

export interface AuthKitOptions {
  /** The app's own Firebase Auth instance, or null while the app has no Firebase settings. */
  auth: Auth | null;
  /** Show "Continue with Google" using a web popup (web only). On phones pass `native.google` instead. */
  google?: boolean;
  /** Phone sign-in sheets for Apple and Google. A provider left out is hidden. */
  native?: NativeProviders;
  /** Shortest password accepted at sign-up and when changing it. Firebase itself requires 6. */
  minPassword?: number;
  /** Longest nickname kept. */
  maxNickname?: number;
  /** Called with a place name and the error when something fails quietly (for example, Apple's token revoke), so the app can report it. */
  onError?: (where: string, error: unknown) => void;
  /** Extra or replacement error texts, by Firebase error code. */
  messages?: Record<string, string>;
  /** How long deleting an account may take before it gives up (ms). */
  deleteTimeoutMs?: number;
  /** Shortest gap between two reset emails to the same address (ms). Stops double taps; Firebase's own server limits cover abuse. */
  resetCooldownMs?: number;
  /**
   * Phone storage (pass AsyncStorage) for a fast start: the kit remembers the last signed-in person's profile there, and `useAuth`
   * returns them at once on the next launch with `confirming: true`, instead of waiting for Firebase's network refresh. Forgotten on
   * Sign Out, on Delete Account and whenever Firebase reports nobody. Left out, `useAuth` waits for Firebase as before.
   */
  storage?: AuthStorage;
}
