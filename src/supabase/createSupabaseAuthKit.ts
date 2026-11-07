import type { AuthResponse, SupabaseClient, User } from '@supabase/supabase-js';
import { coded, codeOf } from '../errors';
import { DEFAULT_MESSAGES, FALLBACK_MESSAGE } from '../messages';
import { createNickname } from '../nickname';
import { checkNewPassword } from '../passwordRules';
import { createResetCooldown } from '../resetCooldown';
import { confirmSupabasePassword, createSupabaseDeleteAccount, rpcDeleteUser } from './deleteAccount';
import { fromSupabase, unwrap } from './errors';
import { SUPABASE_MESSAGES } from './messages';
import { createSupabaseProviders } from './providers';
import type { SupabaseAuthKitOptions } from './types';
import { createUseSupabaseAuth } from './useSupabaseAuth';

/**
 * The same kit as `createAuthKit`, on Supabase Auth instead of Firebase: the same actions, rules, error texts and
 * sign-in screen. Pass your Supabase client.
 */
export const createSupabaseAuthKit = (options: SupabaseAuthKitOptions) => {
  const { supabase: client, native = {}, minPassword = 8, maxNickname = 20, deleteTimeoutMs = 30_000, resetCooldownMs = 60_000 } = options;
  const google = !!(options.google || native.google);
  const apple = !!(options.apple || native.apple);
  const messages: Record<string, string> = { ...DEFAULT_MESSAGES, ...SUPABASE_MESSAGES, 'auth/weak-password': `Use at least ${minPassword} characters.`, ...options.messages };

  const requireClient = (): SupabaseClient => {
    if (!client) throw new Error('Supabase is not configured.');
    return client;
  };

  // Who is signed in right now, kept current so `hasPassword()` and friends can answer at once.
  let user: User | null = null;
  const currentUser = () => user;
  const keep = <T extends { user: User | null }>(data: T): T => {
    if (data.user) user = data.user;
    return data;
  };
  try {
    client?.auth.onAuthStateChange((_event, session) => {
      user = session?.user ?? null;
    });
  } catch (e) {
    options.onError?.('auth-state', e);
  }

  const nickname = createNickname(maxNickname);
  const providers = createSupabaseProviders(client, native, currentUser);
  const sendReset = createResetCooldown(resetCooldownMs, async (email) => {
    await unwrap(requireClient().auth.resetPasswordForEmail(email, options.resetRedirectTo ? { redirectTo: options.resetRedirectTo } : undefined));
  });
  const deleteAccount = createSupabaseDeleteAccount({
    requireClient,
    currentUser,
    providers,
    native,
    timeoutMs: deleteTimeoutMs,
    deleteUser: options.deleteUser ?? rpcDeleteUser(requireClient, options.deleteRpc ?? 'delete_user'),
    revokeApple: options.revokeApple,
    onError: options.onError,
  });

  // A second sign-up tap while the first is running joins it, so one account is made and one nickname kept.
  let signingUp: Promise<AuthResponse['data']> | null = null;

  /** Turns an error into a sentence a person can act on. Empty string means "say nothing". */
  const message = (error: unknown): string => {
    const code = codeOf(error);
    return Object.prototype.hasOwnProperty.call(messages, code) ? messages[code] : code ? `${FALLBACK_MESSAGE} (${code})` : FALLBACK_MESSAGE;
  };

  return {
    google,
    apple,
    minPassword,
    maxNickname,
    message,
    takeNickname: nickname.take,
    hasPassword: providers.hasPassword,
    /** True when deleting the account needs the password typed in (false when Apple or Google confirms instead). */
    confirmsWithPassword: (): boolean => providers.hasPassword() && !providers.usesApple(),

    signInEmail: (email: string, password: string) => nickname.run(async () => keep(await unwrap(requireClient().auth.signInWithPassword({ email: email.trim(), password })))),

    /**
     * Creates the account. The nickname (optional) is held for `takeNickname`.
     * When the project asks people to confirm their email, there is no session yet: this throws `auth/check-email`
     * so the screen says to check the inbox. The typed nickname is not carried over to that later sign-in; ask for it after.
     * Supabase answers the same way for an address that already has an account, so the screen cannot reveal who has one.
     */
    signUpEmail: (email: string, password: string, typedNickname = ''): Promise<AuthResponse['data']> => {
      signingUp ??= nickname
        .run(async () => {
          checkNewPassword(minPassword, password);
          const data = keep(await unwrap(requireClient().auth.signUp({ email: email.trim(), password })));
          return data;
        }, typedNickname)
        .then((data) => {
          if (!data.session) throw coded('Confirm your email.', 'auth/check-email');
          return data;
        })
        .finally(() => {
          signingUp = null;
        });
      return signingUp;
    },

    signInGoogle: () =>
      nickname.run(async () => {
        if (native.google) return keep(await providers.google());
        // Web: Supabase takes the browser to Google and back to `oauthRedirectTo`.
        return unwrap(requireClient().auth.signInWithOAuth({ provider: 'google', options: options.oauthRedirectTo ? { redirectTo: options.oauthRedirectTo } : undefined }));
      }),

    /** Signs in (or creates the account) with Apple's sheet, or on the web through Apple's page. Apple may hide the email address; that is fine. */
    signInApple: () =>
      nickname.run(async () => {
        if (native.apple) return keep((await providers.apple()).data);
        // Web: Supabase takes the browser to Apple and back to `oauthRedirectTo`.
        return unwrap(requireClient().auth.signInWithOAuth({ provider: 'apple', options: options.oauthRedirectTo ? { redirectTo: options.oauthRedirectTo } : undefined }));
      }),

    /** Emails a reset link to an address (the "Forgot password" case). An address with no account looks the same as one that has. */
    sendPasswordReset: (email: string) => sendReset(email.trim()),

    /** Emails a reset link to the signed-in person's own address. */
    sendPasswordChange: async (): Promise<void> => {
      const email = user?.email;
      if (!email) throw coded('No email on this account.', 'auth/invalid-email');
      if (!providers.hasPassword()) throw coded('No password on this account.', 'auth/no-password');
      return sendReset(email);
    },

    /** Changes the password: confirms the current one first, then sets the new one. */
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      if (!user?.email || !providers.hasPassword()) throw coded('No password on this account.', 'auth/no-password');
      checkNewPassword(minPassword, newPassword, currentPassword);
      await confirmSupabasePassword(requireClient(), user.email, currentPassword);
      keep(await unwrap(requireClient().auth.updateUser({ password: newPassword })));
    },

    signOut: async (): Promise<void> => {
      nickname.forget();
      const { error } = await requireClient().auth.signOut();
      user = null;
      if (error) throw fromSupabase(error);
    },

    /** See `deleteAccount.ts`. */
    deleteAccount,

    useAuth: createUseSupabaseAuth(client, options.onError),
  };
};

export type SupabaseAuthKit = ReturnType<typeof createSupabaseAuthKit>;
