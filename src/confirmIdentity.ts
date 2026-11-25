import { GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, type User } from 'firebase/auth';
import { confirmPassword } from './confirmPassword';
import { coded } from './errors';
import type { Providers } from './providers';
import type { NativeProviders } from './types';

/** What the check returns: `cancelled` when no password was given; `appleCode` for revoking an Apple token later. */
export type IdentityResult = { cancelled: true } | { cancelled: false; appleCode?: string | null };

/**
 * Confirms the signed-in person again with the way they signed up (Apple, their password, or Google), without signing
 * anyone else in: Firebase re-authentication fails if a different account answers. Shared by Delete Account and
 * `reconfirm`, so both check identity the same way.
 */
export const createConfirmIdentity =
  (providers: Providers, native: NativeProviders) =>
  async (user: User, getPassword: (email: string) => Promise<string | null>): Promise<IdentityResult> => {
    if (providers.usesApple()) {
      const { credential, code } = await providers.appleCredential();
      await reauthenticateWithCredential(user, credential);
      return { cancelled: false, appleCode: code };
    }
    if (providers.hasPassword() && user.email) {
      const password = await getPassword(user.email);
      if (!password) return { cancelled: true };
      await confirmPassword(user, user.email, password);
    } else if (providers.hasProvider('google.com')) {
      if (native.google) await reauthenticateWithCredential(user, await providers.googleCredential());
      else await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } else {
      throw coded('Cannot confirm this sign-in method here.', 'auth/requires-recent-login');
    }
    return { cancelled: false };
  };
