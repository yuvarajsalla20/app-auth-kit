import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { DEFAULT_MESSAGES, FALLBACK_MESSAGE } from './messages';

export type AuthState = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: User };

export interface AuthKitOptions {
  /** The app's own Firebase Auth instance, or null while the app has no Firebase settings. */
  auth: Auth | null;
  /** Show "Continue with Google". Google popups work on the web only; phones need a native module. */
  google?: boolean;
  /** Shortest password accepted at sign-up. Firebase itself requires 6. */
  minPassword?: number;
  /** Longest nickname kept. */
  maxNickname?: number;
  /** Extra or replacement error texts, by Firebase error code. */
  messages?: Record<string, string>;
  /** How long deleting an account may take before it gives up (ms). */
  deleteTimeoutMs?: number;
  /** Shortest gap between two reset or change-password emails (ms). Stops accidental or abusive repeats. */
  resetCooldownMs?: number;
}

/**
 * Everything about signing in, for one app: pass it your Firebase Auth and get the actions,
 * the sign-in state hook and the friendly error text back. Nothing here is specific to any one app.
 */
export const createAuthKit = (options: AuthKitOptions) => {
  const { google = false, minPassword = 8, maxNickname = 20, deleteTimeoutMs = 30_000, resetCooldownMs = 60_000 } = options;
  const messages: Record<string, string> = { ...DEFAULT_MESSAGES, 'auth/weak-password': `Use at least ${minPassword} characters.`, ...options.messages };

  const requireAuth = (): Auth => {
    if (!options.auth) throw new Error('Firebase is not configured.');
    return options.auth;
  };

  // A nickname typed at sign-up, held until the app has created the new profile and takes it.
  let pendingNickname: string | null = null;
  const forgetNickname = () => {
    pendingNickname = null;
  };
  /** Returns the nickname typed at sign-up (once) so the app can save it with the new profile. */
  const takeNickname = (): string | null => {
    const name = pendingNickname;
    pendingNickname = null;
    return name;
  };

  /** Runs a sign-in action; a failure never leaves its nickname behind for the next login. */
  const attempt = async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (e) {
      forgetNickname();
      throw e;
    }
  };

  // One reset or change-password email per cooldown, so a double tap or a script cannot flood an inbox.
  let lastResetAt = 0;
  const sendReset = async (email: string): Promise<void> => {
    if (Date.now() - lastResetAt < resetCooldownMs) throw Object.assign(new Error('Wait before asking again.'), { code: 'auth/reset-cooldown' });
    await sendPasswordResetEmail(requireAuth(), email);
    lastResetAt = Date.now();
  };

  const hasPassword = (): boolean => !!options.auth?.currentUser?.providerData.some((p) => p.providerId === 'password');

  /** Turns an error into a sentence a person can act on. Empty string means "say nothing". */
  const message = (error: unknown): string => {
    const code = (error as { code?: string })?.code ?? '';
    return code in messages ? messages[code] : FALLBACK_MESSAGE;
  };

  return {
    google,
    minPassword,
    maxNickname,
    message,
    takeNickname,
    hasPassword,

    signInEmail: (email: string, password: string) =>
      attempt(() => signInWithEmailAndPassword(requireAuth(), email.trim(), password)),

    /** Creates the account. The nickname (optional) is held for `takeNickname`. */
    signUpEmail: (email: string, password: string, nickname = '') => {
      pendingNickname = nickname.trim().slice(0, maxNickname) || null;
      return attempt(() => createUserWithEmailAndPassword(requireAuth(), email.trim(), password));
    },

    signInGoogle: () => attempt(() => signInWithPopup(requireAuth(), new GoogleAuthProvider())),

    /** Emails a reset link to an address (the "Forgot password" case). */
    sendPasswordReset: (email: string) => sendReset(email.trim()),

    /** Emails a reset link to the signed-in person's own address (the "Change password" case). */
    sendPasswordChange: () => {
      const email = requireAuth().currentUser?.email;
      if (!email) throw Object.assign(new Error('No email on this account.'), { code: 'auth/invalid-email' });
      return sendReset(email);
    },

    signOut: () => {
      forgetNickname();
      return firebaseSignOut(requireAuth());
    },

    /**
     * Deletes the account for good: confirms it is really them, runs `eraseData` (the app deletes its own
     * data there), then removes the login. Apple requires an in-app way to do this.
     */
    deleteAccount: async (password: string, eraseData: () => Promise<void>): Promise<void> => {
      const user = requireAuth().currentUser;
      if (!user) throw new Error('Sign in first.');
      await (hasPassword() && user.email
        ? reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
        : reauthenticateWithPopup(user, new GoogleAuthProvider()));
      // Without a signal the erase would wait forever, so give up and let them retry.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'auth/delete-timeout' })), deleteTimeoutMs);
        eraseData().then(resolve, reject).finally(() => clearTimeout(timer));
      });
      await deleteUser(user);
    },

    /** Who is signed in. `loading` lasts only until Firebase has restored the saved sign-in. */
    useAuth: (enabled = true): AuthState => {
      const [state, setState] = useState<AuthState>({ status: 'loading' });
      useEffect(() => {
        if (!enabled) return;
        return onAuthStateChanged(requireAuth(), (user) => setState(user ? { status: 'in', user } : { status: 'out' }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [enabled]);
      return state;
    },
  };
};

export type AuthKit = ReturnType<typeof createAuthKit>;
