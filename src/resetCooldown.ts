import { coded, codeOf } from './errors';

/**
 * Sends at most one reset email per address per cooldown, so a double tap sends one. The time is taken before the
 * send (two quick taps cannot both pass) and given back if the send fails. An address with no account looks like
 * success, so the screen cannot be used to find out who has one.
 */
export const createResetCooldown = (cooldownMs: number, send: (email: string) => Promise<void>) => {
  const lastSent = new Map<string, number>();
  return async (email: string): Promise<void> => {
    const key = email.toLowerCase();
    const now = Date.now();
    if (now - (lastSent.get(key) ?? -Infinity) < cooldownMs) throw coded('Wait before asking again.', 'auth/reset-cooldown');
    lastSent.set(key, now);
    try {
      await send(email);
    } catch (e) {
      if (codeOf(e) === 'auth/user-not-found') return;
      lastSent.delete(key);
      throw e;
    }
  };
};
