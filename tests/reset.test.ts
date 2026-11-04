import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthKit } from '../src/createAuthKit';
import { authWith, deferred, fail, fns, resetSpies } from './helpers';

beforeEach(resetSpies);
const kit = () => createAuthKit({ auth: authWith([]), resetCooldownMs: 60_000 });

describe('forgot password', () => {
  it('a double tap sends one email', async () => {
    const gate = deferred();
    fns.sendPasswordResetEmail.mockReturnValue(gate.promise);
    const k = kit();
    const first = k.sendPasswordReset('a@b.com');
    await expect(k.sendPasswordReset('a@b.com')).rejects.toMatchObject({ code: 'auth/reset-cooldown' });
    gate.resolve();
    await first;
    expect(fns.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });
  it('a corrected address is not refused', async () => {
    const k = kit();
    await k.sendPasswordReset('typo@b.com');
    await k.sendPasswordReset('right@b.com');
    expect(fns.sendPasswordResetEmail).toHaveBeenCalledTimes(2);
  });
  it('allows another email after the cooldown', async () => {
    vi.useFakeTimers();
    const k = kit();
    await k.sendPasswordReset('a@b.com');
    vi.advanceTimersByTime(61_000);
    await k.sendPasswordReset('a@b.com');
    expect(fns.sendPasswordResetEmail).toHaveBeenCalledTimes(2);
  });
  it('a failed send does not use up the cooldown', async () => {
    fns.sendPasswordResetEmail.mockRejectedValueOnce(fail('auth/network-request-failed'));
    const k = kit();
    await expect(k.sendPasswordReset('a@b.com')).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    await k.sendPasswordReset('a@b.com');
    expect(fns.sendPasswordResetEmail).toHaveBeenCalledTimes(2);
  });
  it('an address with no account looks like success', async () => {
    fns.sendPasswordResetEmail.mockRejectedValue(fail('auth/user-not-found'));
    await expect(kit().sendPasswordReset('nobody@b.com')).resolves.toBeUndefined();
  });
});
