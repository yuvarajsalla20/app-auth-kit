import { vi } from 'vitest';
import * as fb from './stubs/firebase-auth';

export const fns = fb;

/** A fake Firebase Auth whose current person uses the given providers. */
export const authWith = (providers: string[], email: string | null = 'a@b.com') =>
  ({ currentUser: email === null && !providers.length ? null : { email, providerData: providers.map((providerId) => ({ providerId })) } }) as never;

export const resetSpies = () => {
  for (const f of Object.values(fb)) if (typeof f === 'function' && 'mockReset' in f) (f as ReturnType<typeof vi.fn>).mockReset();
  fb.EmailAuthProvider.credential.mockImplementation((email: string, password: string) => ({ kind: 'password', email, password }));
  for (const f of [fb.deleteUser, fb.reauthenticateWithCredential, fb.reauthenticateWithPopup, fb.revokeAccessToken, fb.sendPasswordResetEmail, fb.updatePassword, fb.signOut]) f.mockResolvedValue(undefined);
  vi.useRealTimers();
};

export const deferred = <T = void>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

export const fail = (code: string) => Object.assign(new Error(code), { code });
