import { deleteUser, revokeAccessToken, type Auth } from 'firebase/auth';
import { withTimeout } from 'app-core-kit';
import { createConfirmIdentity } from './confirmIdentity';
import { coded } from '../shared/errors';
import type { Providers } from '../session/providers';
import type { NativeProviders } from '../types';

interface Deps {
  requireAuth: () => Auth;
  providers: Providers;
  native: NativeProviders;
  timeoutMs: number;
  /** Drops what this phone holds for the person (a nickname held for a sign-up, the remembered person), as Sign Out does. */
  forgetHere: () => void;
  onError?: (where: string, error: unknown) => void;
}

/**
 * Deletes the account for good: confirms it is really them, runs `eraseData` (the app deletes its own data there),
 * then removes the login. Apple requires an in-app way to do this.
 * Only one delete runs at a time, and a retry after a timeout waits for the first erase instead of starting a second.
 * `eraseData` must be safe to run again, because a failed delete can be retried.
 */
export const createDeleteAccount = ({ requireAuth, providers, native, timeoutMs, forgetHere, onError }: Deps) => {
  let running = false;
  let erasing: Promise<void> | null = null;

  const confirmIdentity = createConfirmIdentity(providers, native);

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
      const checked = await confirmIdentity(user, async () => password);
      if (checked.cancelled) throw coded('Wrong current password.', 'auth/wrong-current-password');
      const appleCode = checked.appleCode;
      await erase(eraseData);
      // Apple requires the app to revoke its token when a Sign in with Apple account is deleted.
      // A failed revoke must not leave the person with an undeletable account, so it is reported and the deletion goes on.
      if (appleCode) await revokeAccessToken(requireAuth(), appleCode).catch((e) => onError?.('apple-revoke', e));
      await deleteUser(user).catch((e) => {
        onError?.('delete-user', e); // the data is already gone; the app can offer "finish deleting"
        throw e;
      });
      // The login is gone, which signs this phone out of Firebase. As Sign Out does, forget the phone's Google account
      // too, so the next Google sign-in asks which account instead of picking the deleted one.
      forgetHere();
      await native.signOut?.().catch((e) => onError?.('native-sign-out', e));
    } finally {
      running = false;
    }
  };
};
