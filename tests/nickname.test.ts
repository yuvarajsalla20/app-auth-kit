import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthKit } from '../src/createAuthKit';
import { createNickname } from '../src/nickname';
import { authWith, deferred, fail, fns, resetSpies } from './helpers';

beforeEach(resetSpies);

describe('nickname', () => {
  it('is handed out once', async () => {
    const n = createNickname(20);
    await n.run(async () => 1, '  Sam  ');
    expect(n.take()).toBe('Sam');
    expect(n.take()).toBeNull();
  });
  it('is cut to the longest allowed', async () => {
    const n = createNickname(3);
    await n.run(async () => 1, 'abcdef');
    expect(n.take()).toBe('abc');
  });
  it('is forgotten when its own sign-up fails', async () => {
    const n = createNickname(20);
    await expect(n.run(() => Promise.reject(fail('x')), 'Sam')).rejects.toBeTruthy();
    expect(n.take()).toBeNull();
  });
  it('an older failure never wipes a newer nickname', async () => {
    const n = createNickname(20);
    const slow = deferred<number>();
    const first = n.run(() => slow.promise, 'old');
    await n.run(async () => 2, 'new');
    slow.reject(fail('x'));
    await expect(first).rejects.toBeTruthy();
    expect(n.take()).toBe('new');
  });
});

describe('sign-up through the kit', () => {
  it('a double tap makes one account and keeps the nickname', async () => {
    const created = deferred<{ ok: true }>();
    fns.createUserWithEmailAndPassword.mockReturnValue(created.promise);
    const kit = createAuthKit({ auth: authWith([]) });
    const a = kit.signUpEmail('a@b.com', 'password1', 'Sam');
    const b = kit.signUpEmail('a@b.com', 'password1', 'Sam');
    created.resolve({ ok: true });
    await Promise.all([a, b]);
    expect(fns.createUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(kit.takeNickname()).toBe('Sam');
  });
  it('refuses a short password before calling Firebase', async () => {
    const kit = createAuthKit({ auth: authWith([]), minPassword: 8 });
    await expect(kit.signUpEmail('a@b.com', 'abc123')).rejects.toMatchObject({ code: 'auth/weak-password' });
    expect(fns.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(kit.takeNickname()).toBeNull();
  });
  it('sign-out forgets a waiting nickname', async () => {
    fns.createUserWithEmailAndPassword.mockResolvedValue({});
    const kit = createAuthKit({ auth: authWith([]) });
    await kit.signUpEmail('a@b.com', 'password1', 'Sam');
    await kit.signOut();
    expect(kit.takeNickname()).toBeNull();
  });
  it('is cut by whole characters, never inside an emoji', async () => {
    const n = createNickname(3);
    await n.run(async () => 1, 'ab😀cd');
    expect(n.take()).toBe('ab😀');
  });
  it('a nickname nobody took is dropped by the next ordinary sign-in', async () => {
    const n = createNickname(20);
    await n.run(async () => 1, 'Nova');
    await n.run(async () => 1);
    expect(n.take()).toBeNull();
  });
  it('an ordinary sign-in never drops the nickname of a sign-up that is still running', async () => {
    const n = createNickname(20);
    const gate = deferred();
    const signUp = n.run(() => gate.promise, 'Nova');
    await n.run(async () => 1);
    gate.resolve();
    await signUp;
    expect(n.take()).toBe('Nova');
  });
});
