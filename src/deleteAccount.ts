import { deleteUser, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, revokeAccessToken, type Auth } from 'firebase/auth';
import { withTimeout } from 'app-core-kit';
import { coded } from './errors';
import type { Providers } from './providers';
import type { NativeProviders } from './types';

interface Deps {
  requireAuth: () => Auth;
  providers: Providers;
  native: NativeProviders;
  timeoutMs: number;
  onError?: (where: string, error: unknown) => void;
}

/**
 * Deletes the account for good: confirms it is really them, runs `eraseData` (the app deletes its own data there),
 * then removes the login. Apple requires an in-app way to do this.
 * Only one delete runs at a time, and a retry after a timeout waits for the first erase instead of starting a second.
 * `eraseData` must be safe to run again, because a failed delete can be retried.
 */
export const createDeleteAccount = ({ requireAuth, providers, native, timeoutMs, onError }: Deps) => {
  let running = false;
  let erasing: Promise<void> | null = null;

  const confirmIdentity = async (user: NonNullable<Auth['currentUser']>, password: string): Promise<string | null | undefined> => {
    if (providers.usesApple()) {
      const { credential, code } = await providers.appleCredential();
      await reauthenticateWithCredential(user, credential);
      return code;
    }
    if (providers.hasPassword() && user.email) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else if (providers.hasProvider('google.com')) {
      if (native.google) await reauthenticateWithCredential(user, await providers.googleCredential());
      else await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } else {
      throw coded('Cannot confirm this sign-in method here.', 'auth/requires-recent-login');
    }
    return undefined;
  };

  /** Starts the erase once; a retry while it is still running joins it. Gives up waiting after the timeout. */
  const erase = (eraseData: () => Promise<void>): Promise<void> => {
    if (!erasing) {
      const started: Promise<void> = Promise.resolve()
        .then(eraseData)
        .finally(() => {
          if (erasing === started) erasing = null;
        });
      started.catch(() => {}); // a late failure after we stopped waiting is not an unhandled error
      erasing = started;
    }
    return withTimeout(erasing, timeoutMs, 'timeout').catch((e: Error) => {
      throw e.message === 'timeout' ? coded(e.message, 'auth/delete-timeout') : e;
    });
  };

  return async (password: string, eraseData: () => Promise<void>): Promise<void> => {
    if (running) throw coded('Already deleting.', 'auth/delete-in-progress');
    running = true;
    try {
      const user = requireAuth().currentUser;
      if (!user) throw new Error('Sign in first.');
      const appleCode = await confirmIdentity(user, password);
      await erase(eraseData);
      // Apple requires the app to revoke its token when a Sign in with Apple account is deleted.
      // A failed revoke must not leave the person with an undeletable account, so it is reported and the deletion goes on.
      if (appleCode) await revokeAccessToken(requireAuth(), appleCode).catch((e) => onError?.('apple-revoke', e));
      await deleteUser(user).catch((e) => {
        onError?.('delete-user', e); // the data is already gone; the app can offer "finish deleting"
        throw e;
      });
    } finally {
      running = false;
    }
  };
};
