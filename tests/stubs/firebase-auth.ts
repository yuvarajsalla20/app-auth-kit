// Stand-in for firebase/auth: every function is a spy the tests can program.
import { vi } from 'vitest';

export const createUserWithEmailAndPassword = vi.fn();
export const deleteUser = vi.fn();
export const onAuthStateChanged = vi.fn();
export const reauthenticateWithCredential = vi.fn();
export const reauthenticateWithPopup = vi.fn();
export const revokeAccessToken = vi.fn();
export const sendPasswordResetEmail = vi.fn();
export const signInWithCredential = vi.fn();
export const signInWithEmailAndPassword = vi.fn();
export const signInWithPopup = vi.fn();
export const signOut = vi.fn();
export const updatePassword = vi.fn();
export const EmailAuthProvider = { credential: vi.fn((email: string, password: string) => ({ kind: 'password', email, password })) };
export class GoogleAuthProvider {
  static credential = vi.fn((idToken: string) => ({ kind: 'google', idToken }));
}
export class OAuthProvider {
  constructor(public id: string) {}
  credential(x: unknown) { return { kind: 'apple', ...(x as object) }; }
}
