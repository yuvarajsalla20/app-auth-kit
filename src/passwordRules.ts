import { coded } from './errors';

/** Throws the same plain error at sign-up and when changing a password, so the rules cannot differ. */
export const checkNewPassword = (minLength: number, next: string, current?: string): void => {
  if (next.length < minLength) throw coded('Password too short.', 'auth/weak-password');
  if (current !== undefined && next === current) throw coded('New password is the same as the old one.', 'auth/same-password');
};
