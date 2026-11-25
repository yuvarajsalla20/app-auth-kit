import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import { createConfirmIdentity } from '../delete-account/confirmIdentity';
import { createDeleteAccount } from '../delete-account/deleteAccount';
import { codeOf } from '../shared/errors';
import { DEFAULT_MESSAGES, FALLBACK_MESSAGE } from '../shared/messages';
import { createNickname } from './nickname';
import { checkNewPassword } from '../password/passwordRules';
import { createPasswordActions } from '../password/passwordActions';
import { createProviders } from './providers';
import { createUserMemory } from './rememberUser';
import { createResetCooldown } from '../password/resetCooldown';
import type { AuthKitOptions } from '../types';
import { createUseAuth } from './useAuth';

/**
 * Everything about signing in, for one app: pass it your Firebase Auth and get the actions,
 * the sign-in state hook and the friendly error text back. Nothing here is specific to any one app.
 */
export const createAuthKit = (options: AuthKitOptions) => {
  const { native = {}, minPassword = 8, maxNickname = 20, deleteTimeoutMs = 30_000, resetCooldownMs = 60_000 } = options;
  const google = !!(options.google || native.google);
  const apple = !!native.apple;
  const messages: Record<string, string> = { ...DEFAULT_MESSAGES, 'auth/weak-password': `Use at least ${minPassword} characters.`, ...options.messages };

  const requireAuth = (): Auth => {
    if (!options.auth) throw new Error('Firebase is not configured.');
    return options.auth;
  };

  const nickname = createNickname(maxNickname);
  const providers = createProviders(options.auth, native);
  const sendReset = createResetCooldown(resetCooldownMs, (email) => sendPasswordResetEmail(requireAuth(), email));
  // The remembered person (only with `storage`), read now so it is usually ready by the app's first render.
  const memory = options.auth && options.storage ? createUserMemory(options.auth, options.storage, options.onError) : undefined;
  void memory?.load();
  const forgetHere = () => {
    nickname.forget();
    memory?.forget();
  };
  const confirmIdentity = createConfirmIdentity(providers, native);
  const deleteAccount = createDeleteAccount({ requireAuth, providers, native, timeoutMs: deleteTimeoutMs, forgetHere, onError: options.onError });

  // A second sign-up tap while the first is running joins it, so one account is made and one nickname kept.
  let signingUp: Promise<UserCredential> | null = null;

  /** Turns an error into a sentence a person can act on. Empty string means "say nothing". */
  const message = (error: unknown): string => {
    const code = codeOf(error);
    // An unknown error shows its code in brackets, so a screenshot is enough to tell what failed.
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

    signInEmail: (email: string, password: string) => nickname.run(() => signInWithEmailAndPassword(requireAuth(), email.trim(), password)),

    /** Creates the account. The nickname (optional) is held for `takeNickname`. */
    signUpEmail: (email: string, password: string, typedNickname = ''): Promise<UserCredential> => {
      signingUp ??= nickname
        .run(async () => {
          checkNewPassword(minPassword, password);
          return createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
        }, typedNickname)
        .finally(() => {
          signingUp = null;
        });
      return signingUp;
    },

    signInGoogle: () =>
      nickname.run(async () => (native.google ? signInWithCredential(requireAuth(), await providers.googleCredential()) : signInWithPopup(requireAuth(), new GoogleAuthProvider()))),

    /** Signs in (or creates the account) with Apple's sheet. Apple may hide the email address; that is fine. */
    signInApple: () => nickname.run(async () => signInWithCredential(requireAuth(), (await providers.appleCredential()).credential)),

    /** Emails a reset link to an address (the "Forgot password" case). An address with no account looks the same as one that has. */
    sendPasswordReset: (email: string) => sendReset(email.trim()),

    ...createPasswordActions({ requireAuth, providers, minPassword, sendReset }),

    signOut: async () => {
      nickname.forget();
      await firebaseSignOut(requireAuth());
      memory?.forget();
      // Also forget the phone's Google sign-in, so the next person picks their own account. A failure here must not undo the sign-out.
      await native.signOut?.().catch((e) => options.onError?.('native-sign-out', e));
    },

    /** See `deleteAccount.ts`. */
    deleteAccount,

    /**
     * Confirms that the signed-in person is still the one using the phone (e.g., "Forgot PIN" in app-guard-kit), with
     * the way they signed up: Apple, their password (asked through `askPassword`), or Google. It re-authenticates the
     * same account and never signs anyone else in. Resolves true when confirmed; false when cancelled, wrong or failed.
     */
    reconfirm: async (askPassword: (email: string) => Promise<string | null>): Promise<boolean> => {
      const user = options.auth?.currentUser;
      if (!user) return false;
      try {
        return !(await confirmIdentity(user, askPassword)).cancelled;
      } catch (e) {
        options.onError?.('reconfirm', e);
        return false;
      }
    },

    useAuth: createUseAuth(options.auth, options.onError, memory),
  };
};

export type AuthKit = ReturnType<typeof createAuthKit>;
