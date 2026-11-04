import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthKit } from '../src/createAuthKit';
import { authWith, deferred, fail, fns, resetSpies } from './helpers';

beforeEach(resetSpies);

describe('deleteAccount (password account)', () => {
  const make = (extra = {}) => createAuthKit({ auth: authWith(['password']), deleteTimeoutMs: 50, ...extra });

  it('a wrong password stops before anything is erased', async () => {
    fns.reauthenticateWithCredential.mockRejectedValue(fail('auth/invalid-credential'));
    const erase = vi.fn();
    await expect(make().deleteAccount('bad', erase)).rejects.toBeTruthy();
    expect(erase).not.toHaveBeenCalled();
    expect(fns.deleteUser).not.toHaveBeenCalled();
  });
  it('erases the data first and the login last', async () => {
    const order: string[] = [];
    fns.deleteUser.mockImplementation(async () => { order.push('login'); });
    await make().deleteAccount('pw', async () => { order.push('data'); });
    expect(order).toEqual(['data', 'login']);
  });
  it('gives up on a slow erase with its own code', async () => {
    await expect(make().deleteAccount('pw', () => new Promise(() => {}))).rejects.toMatchObject({ code: 'auth/delete-timeout' });
    expect(fns.deleteUser).not.toHaveBeenCalled();
  });
  it('a retry after a timeout joins the first erase instead of starting a second', async () => {
    const gate = deferred();
    const erase = vi.fn(() => gate.promise);
    const k = make();
    await expect(k.deleteAccount('pw', erase)).rejects.toMatchObject({ code: 'auth/delete-timeout' });
    const retry = k.deleteAccount('pw', erase);
    gate.resolve();
    await retry;
    expect(erase).toHaveBeenCalledTimes(1);
    expect(fns.deleteUser).toHaveBeenCalledTimes(1);
  });
  it('blocks a second delete while one is running', async () => {
    const gate = deferred();
    const k = make({ deleteTimeoutMs: 1000 });
    const first = k.deleteAccount('pw', () => gate.promise);
    await expect(k.deleteAccount('pw', async () => {})).rejects.toMatchObject({ code: 'auth/delete-in-progress' });
    gate.resolve();
    await first;
  });
  it('reports a failed login removal but keeps the error', async () => {
    const onError = vi.fn();
    fns.deleteUser.mockRejectedValue(fail('auth/network-request-failed'));
    await expect(make({ onError }).deleteAccount('pw', async () => {})).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    expect(onError).toHaveBeenCalledWith('delete-user', expect.anything());
  });
});

describe('deleteAccount (other sign-in methods)', () => {
  it('Apple: revokes with the code, and a failed revoke still deletes', async () => {
    const onError = vi.fn();
    fns.revokeAccessToken.mockRejectedValue(fail('x'));
    const native = { apple: async () => ({ idToken: 't', rawNonce: 'n', authorizationCode: 'code1' }) };
    const k = createAuthKit({ auth: authWith(['apple.com', 'password']), native, onError });
    expect(k.confirmsWithPassword()).toBe(false);
    await k.deleteAccount('', async () => {});
    expect(fns.revokeAccessToken).toHaveBeenCalledWith(expect.anything(), 'code1');
    expect(onError).toHaveBeenCalledWith('apple-revoke', expect.anything());
    expect(fns.deleteUser).toHaveBeenCalled();
  });
  it('Google on the web uses the popup', async () => {
    const k = createAuthKit({ auth: authWith(['google.com']), google: true });
    await k.deleteAccount('', async () => {});
    expect(fns.reauthenticateWithPopup).toHaveBeenCalled();
  });
  it('an unsupported sign-in method fails clearly instead of opening a popup', async () => {
    const k = createAuthKit({ auth: authWith(['apple.com']) });
    const erase = vi.fn();
    await expect(k.deleteAccount('', erase)).rejects.toMatchObject({ code: 'auth/requires-recent-login' });
    expect(erase).not.toHaveBeenCalled();
    expect(fns.reauthenticateWithPopup).not.toHaveBeenCalled();
  });
  it('asks to sign in first when nobody is signed in', async () => {
    const k = createAuthKit({ auth: { currentUser: null } as never });
    await expect(k.deleteAccount('', async () => {})).rejects.toThrow('Sign in first.');
  });
});
