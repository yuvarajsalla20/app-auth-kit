import type { SupabaseClient, User } from '@supabase/supabase-js';
import { withTimeout } from 'app-core-kit';
import { codeOf, coded } from '../errors';
import type { NativeProviders } from '../providerTypes';
import { fromSupabase, unwrap } from './errors';
import type { SupabaseProviders } from './providers';

interface Deps {
  requireClient: () => SupabaseClient;
  currentUser: () => User | null;
  providers: SupabaseProviders;
  native: NativeProviders;
  timeoutMs: number;
  deleteUser: () => Promise<void>;
  revokeApple?: (authorizationCode: string) => Promise<void>;
  /** Drops a nickname held for a sign-up, as Sign Out does. */
  forgetNickname: () => void;
  onError?: (where: string, error: unknown) => void;
}

/** Signs the person in again with their password. A wrong one says so plainly. */
export const confirmSupabasePassword = async (client: SupabaseClient, email: string, password: string): Promise<void> => {
  try {
    await unwrap(client.auth.signInWithPassword({ email, password }));
  } catch (e) {
    const code = codeOf(e);
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') throw coded('Wrong current password.', 'auth/wrong-current-password');
    throw e;
  }
};

/**
 * Deletes the account for good, with the same rules as the Firebase kit: confirm it is really them, run `eraseData`
 * (the app deletes its own data there), then remove the login. One delete at a time; a retry after a timeout joins the
 * first erase instead of starting a second, so `eraseData` must be safe to run again.
 */
export const createSupabaseDeleteAccount = ({ requireClient, currentUser, providers, native, timeoutMs, deleteUser, revokeApple, forgetNickname, onError }: Deps) => {
  let running = false;
  let erasing: Promise<void> | null = null;

  /**
   * Confirming with Apple or Google signs in again, and the sheet lets the person pick any account. Unlike Firebase's
   * re-check, Supabase then simply switches to that account, and `delete_user` would remove it instead. So a different
   * account is signed out of this phone again and the delete stops before anything is erased.
   */
  const sameAccount = async (user: User, signedIn: { user: User | null }): Promise<void> => {
    if (signedIn.user?.id === user.id) return;
    await requireClient().auth.signOut({ scope: 'local' }).catch((e) => onError?.('sign-out', e));
    throw coded('A different account was chosen.', 'auth/user-mismatch');
  };

  const confirmIdentity = async (user: User, password: string): Promise<string | null | undefined> => {
    if (providers.usesApple()) {
      const { data, code } = await providers.apple();
      await sameAccount(user, data);
      return code;
    }
    if (providers.hasPassword() && user.email) {
      await confirmSupabasePassword(requireClient(), user.email, password);
    } else if (providers.hasProvider('google')) {
      // On phones Google's sheet confirms it. On the web the open session is the proof (Supabase has no popup re-check),
      // and the app's own confirmation panel has already asked.
      if (native.google) await sameAccount(user, await providers.google());
    } else if (providers.hasProvider('apple')) {
      // Apple on the web (no sheet here): the open session is the proof, as with Google. Apple's token can only be
      // revoked with a code from the iPhone sheet, so that step is skipped on the web.
    } else {
      throw coded('Cannot confirm this sign-in method here.', 'auth/requires-recent-login');
    }
    return undefined;
  };

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
      const user = currentUser();
      if (!user) throw new Error('Sign in first.');
      const appleCode = await confirmIdentity(user, password);
      await erase(eraseData);
      if (appleCode && revokeApple) await revokeApple(appleCode).catch((e) => onError?.('apple-revoke', e));
      await deleteUser().catch((e) => {
        onError?.('delete-user', e); // the data is already gone; the app can offer "finish deleting"
        throw e;
      });
      // The login is gone on the server; clear the saved session on this phone. Nothing to wait for if it fails.
      await requireClient().auth.signOut({ scope: 'local' }).catch((e) => onError?.('sign-out', e));
      // As Sign Out does: forget the phone's Google account too, so the next sign-in asks which account.
      forgetNickname();
      await native.signOut?.().catch((e) => onError?.('native-sign-out', e));
    } finally {
      running = false;
    }
  };
};

/** The default `deleteUser`: calls a database function that deletes the signed-in user (SQL in the README). */
export const rpcDeleteUser = (requireClient: () => SupabaseClient, name: string) => async (): Promise<void> => {
  const { error } = await requireClient().rpc(name);
  if (error) throw fromSupabase(error);
};
