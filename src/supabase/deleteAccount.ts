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
export const createSupabaseDeleteAccount = ({ requireClient, currentUser, providers, native, timeoutMs, deleteUser, revokeApple, onError }: Deps) => {
  let running = false;
  let erasing: Promise<void> | null = null;

  const confirmIdentity = async (user: User, password: string): Promise<string | null | undefined> => {
    if (providers.usesApple()) return (await providers.apple()).code;
    if (providers.hasPassword() && user.email) {
      await confirmSupabasePassword(requireClient(), user.email, password);
    } else if (providers.hasProvider('google')) {
      // On phones Google's sheet confirms it. On the web the open session is the proof (Supabase has no popup re-check),
      // and the app's own confirmation panel has already asked.
      if (native.google) await providers.google();
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
