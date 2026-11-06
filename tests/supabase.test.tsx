import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseAuthKit } from '../src/supabase';
import { subscribeSupabaseAuth } from '../src/supabase/useSupabaseAuth';
import { SignInScreen } from '../src/SignInScreen';
import { DEFAULT_STRINGS as S } from '../src/theme';
import { deferred } from './helpers';
import { mount, press, type } from './render';

const ok = <T,>(data: T) => ({ data, error: null });
const err = (code: string, message = code, extra: Record<string, unknown> = {}) => ({ data: { user: null, session: null }, error: { code, message, name: 'AuthApiError', status: 400, ...extra } });
const userWith = (providers: string[], email: string | null = 'a@b.com') => ({ id: 'u1', email, app_metadata: { providers }, identities: providers.map((provider) => ({ provider })) });

/** A stand-in Supabase client: every auth call is a spy; `as(user)` signs someone in through the listener. */
const makeClient = (user: ReturnType<typeof userWith> | null = null) => {
  const listeners: ((event: string, session: unknown) => void)[] = [];
  const session = (u: unknown) => (u ? { user: u } : null);
  const auth = {
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      listeners.push(cb);
      cb('INITIAL_SESSION', session(user));
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string }) => ok({ user: userWith(['email'], email), session: {} })),
    signUp: vi.fn(async ({ email }: { email: string }) => ok({ user: userWith(['email'], email), session: {} })),
    signInWithIdToken: vi.fn(async ({ provider }: { provider: string }) => ok({ user: userWith([provider]), session: {} })),
    signInWithOAuth: vi.fn(async () => ok({ provider: 'google', url: 'https://x' })),
    resetPasswordForEmail: vi.fn(async () => ok({})),
    updateUser: vi.fn(async () => ok({ user: userWith(['email']) })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  return { client: { auth, rpc } as never, auth, rpc, as: (u: unknown) => listeners.forEach((cb) => cb('SIGNED_IN', session(u))) };
};

const kitFor = (user: ReturnType<typeof userWith> | null = null, extra: Record<string, unknown> = {}) => {
  const c = makeClient(user);
  return { ...c, kit: createSupabaseAuthKit({ supabase: c.client, deleteTimeoutMs: 50, ...extra }) };
};

beforeEach(() => vi.useRealTimers());

describe('app-auth-kit/supabase', () => {
  it('does not import Firebase anywhere along its import graph', () => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      for (const [, spec] of text.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/firebase/);
        if (spec.startsWith('.')) {
          const base = resolve(dirname(file), spec);
          const next = ['.ts', '.tsx', '/index.ts'].map((x) => base + x).find((f) => existsSync(f));
          if (next) walk(next);
        }
      }
    };
    walk(resolve(__dirname, '../supabase.ts'));
    expect(seen.size).toBeGreaterThan(10);
  });
  it('is not configured: actions fail plainly and useAuth reports signed out', async () => {
    const kit = createSupabaseAuthKit({ supabase: null });
    await expect(kit.signInEmail('a@b.com', 'pw')).rejects.toThrow('Supabase is not configured.');
    const set = vi.fn();
    expect(subscribeSupabaseAuth(null, true, set)).toBeUndefined();
    expect(set).toHaveBeenCalledWith({ status: 'out' });
  });
});

describe('sign in and sign up', () => {
  it('signs in with a trimmed email', async () => {
    const { auth, kit } = kitFor();
    await kit.signInEmail('  a@b.com ', 'pw');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
    expect(kit.hasPassword()).toBe(true);
  });
  it('a wrong password shows the same text as the Firebase kit', async () => {
    const { auth, kit } = kitFor();
    auth.signInWithPassword.mockResolvedValueOnce(err('invalid_credentials', 'Invalid login credentials') as never);
    const e = await kit.signInEmail('a@b.com', 'bad').catch((x) => x);
    expect(e).toMatchObject({ code: 'auth/invalid-credential' });
    expect(kit.message(e)).toBe('Email or password is not correct.');
  });
  it('an old server with no code still maps a wrong password', async () => {
    const { auth, kit } = kitFor();
    auth.signInWithPassword.mockResolvedValueOnce(err('', 'Invalid login credentials', { code: undefined }) as never);
    expect(kit.message(await kit.signInEmail('a@b.com', 'bad').catch((x) => x))).toBe('Email or password is not correct.');
  });
  it('a lost connection says so', async () => {
    const { auth, kit } = kitFor();
    auth.signInWithPassword.mockResolvedValueOnce(err('', 'Failed to fetch', { name: 'AuthRetryableFetchError', status: 0, code: undefined }) as never);
    expect(kit.message(await kit.signInEmail('a@b.com', 'pw').catch((x) => x))).toMatch(/connection/i);
  });
  it('an unknown error shows its code so a screenshot tells what failed', async () => {
    const { auth, kit } = kitFor();
    auth.signInWithPassword.mockResolvedValueOnce(err('captcha_failed') as never);
    expect(kit.message(await kit.signInEmail('a@b.com', 'pw').catch((x) => x))).toMatch(/\(supabase\/captcha_failed\)$/);
  });
  it('sign-up checks the password length before calling Supabase', async () => {
    const { auth, kit } = kitFor();
    const e = await kit.signUpEmail('a@b.com', 'short').catch((x) => x);
    expect(kit.message(e)).toBe('Use at least 8 characters.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it('sign-up keeps the nickname; a double tap makes one account', async () => {
    const { auth, kit } = kitFor();
    const gate = deferred<unknown>();
    auth.signUp.mockImplementationOnce(() => gate.promise as never);
    const a = kit.signUpEmail('a@b.com', 'long-enough', 'Hema');
    const b = kit.signUpEmail('a@b.com', 'long-enough', 'Hema');
    gate.resolve(ok({ user: userWith(['email']), session: {} }));
    await Promise.all([a, b]);
    expect(auth.signUp).toHaveBeenCalledTimes(1);
    expect(kit.takeNickname()).toBe('Hema');
  });
  it('when email confirmation is on, sign-up says to check the inbox', async () => {
    const { auth, kit } = kitFor();
    auth.signUp.mockResolvedValueOnce(ok({ user: userWith([]), session: null }) as never);
    const e = await kit.signUpEmail('a@b.com', 'long-enough').catch((x) => x);
    expect(e).toMatchObject({ code: 'auth/check-email' });
    expect(kit.message(e)).toMatch(/check your email/i);
  });
  it('an existing address maps to the Firebase kit text', async () => {
    const { auth, kit } = kitFor();
    auth.signUp.mockResolvedValueOnce(err('user_already_exists') as never);
    expect(kit.message(await kit.signUpEmail('a@b.com', 'long-enough').catch((x) => x))).toMatch(/already exists/);
  });
});

describe('Google and Apple', () => {
  it('native Google passes the ID token; cancelling says nothing', async () => {
    const google = vi.fn(async () => 'g-token');
    const { auth, kit } = kitFor(null, { native: { google } });
    expect(kit.google).toBe(true);
    await kit.signInGoogle();
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'g-token' });
    google.mockResolvedValueOnce(null as never);
    expect(kit.message(await kit.signInGoogle().catch((x) => x))).toBe('');
  });
  it('web Google goes through the redirect', async () => {
    const { auth, kit } = kitFor(null, { google: true, oauthRedirectTo: 'https://app/cb' });
    await kit.signInGoogle();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://app/cb' } });
  });
  it('Apple passes the token and the raw nonce', async () => {
    const apple = vi.fn(async () => ({ idToken: 'a-token', rawNonce: 'n1', authorizationCode: 'c1' }));
    const { auth, kit } = kitFor(null, { native: { apple } });
    expect(kit.apple).toBe(true);
    await kit.signInApple();
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'a-token', nonce: 'n1' });
    expect(kit.confirmsWithPassword()).toBe(false);
  });
});

describe('passwords', () => {
  it('reset sends once per minute and uses the redirect', async () => {
    const { auth, kit } = kitFor(null, { resetRedirectTo: 'myapp://reset' });
    await kit.sendPasswordReset(' a@b.com ');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: 'myapp://reset' });
    expect(kit.message(await kit.sendPasswordReset('a@b.com').catch((x) => x))).toMatch(/wait a minute/i);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });
  it('change password confirms the current one, then sets the new one', async () => {
    const { auth, kit } = kitFor(userWith(['email']));
    await kit.changePassword('old-password', 'new-password');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'old-password' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });
  it('a wrong current password says so in words', async () => {
    const { auth, kit } = kitFor(userWith(['email']));
    auth.signInWithPassword.mockResolvedValueOnce(err('invalid_credentials') as never);
    const e = await kit.changePassword('bad', 'new-password').catch((x) => x);
    expect(kit.message(e)).toBe('Your current password is not correct.');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('refuses the same password, and accounts without one', async () => {
    expect(kitFor(userWith(['email'])).kit.message(await kitFor(userWith(['email'])).kit.changePassword('same-pass', 'same-pass').catch((x) => x))).toMatch(/different/);
    const google = kitFor(userWith(['google']));
    expect(google.kit.hasPassword()).toBe(false);
    expect(await google.kit.changePassword('a', 'bbbbbbbbb').catch((x) => x)).toMatchObject({ code: 'auth/no-password' });
  });
});

describe('deleteAccount', () => {
  it('confirms the password, erases the data, then removes the login and the saved session', async () => {
    const order: string[] = [];
    const { auth, rpc, kit } = kitFor(userWith(['email']));
    rpc.mockImplementation(async () => { order.push('login'); return { data: null, error: null }; });
    await kit.deleteAccount('pw', async () => { order.push('data'); });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
    expect(order).toEqual(['data', 'login']);
    expect(rpc).toHaveBeenCalledWith('delete_user');
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('a wrong password stops before anything is erased', async () => {
    const { auth, rpc, kit } = kitFor(userWith(['email']));
    auth.signInWithPassword.mockResolvedValueOnce(err('invalid_credentials') as never);
    const erase = vi.fn();
    expect(await kit.deleteAccount('bad', erase).catch((x) => x)).toMatchObject({ code: 'auth/wrong-current-password' });
    expect(erase).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('gives up on a slow erase, and a retry joins the first erase', async () => {
    const gate = deferred();
    const erase = vi.fn(() => gate.promise);
    const { kit, rpc } = kitFor(userWith(['email']));
    await expect(kit.deleteAccount('pw', erase)).rejects.toMatchObject({ code: 'auth/delete-timeout' });
    const retry = kit.deleteAccount('pw', erase);
    await new Promise((r) => setTimeout(r, 10));
    gate.resolve();
    await retry;
    expect(erase).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('only one delete runs at a time', async () => {
    const gate = deferred();
    const { kit } = kitFor(userWith(['email']), { deleteTimeoutMs: 5000 });
    const first = kit.deleteAccount('pw', () => gate.promise);
    expect(kit.message(await kit.deleteAccount('pw', vi.fn()).catch((x) => x))).toMatch(/already in progress/);
    gate.resolve();
    await first;
  });
  it('Apple confirms with its sheet and the code goes to revokeApple; a failed revoke is reported, not thrown', async () => {
    const apple = vi.fn(async () => ({ idToken: 't', rawNonce: 'n', authorizationCode: 'code-1' }));
    const revokeApple = vi.fn(async () => { throw new Error('revoke failed'); });
    const onError = vi.fn();
    const { rpc, kit } = kitFor(userWith(['apple', 'email']), { native: { apple }, revokeApple, onError });
    expect(kit.confirmsWithPassword()).toBe(false);
    await kit.deleteAccount('', async () => {});
    expect(revokeApple).toHaveBeenCalledWith('code-1');
    expect(onError).toHaveBeenCalledWith('apple-revoke', expect.any(Error));
    expect(rpc).toHaveBeenCalled();
  });
  it('a failed login removal is reported and thrown', async () => {
    const onError = vi.fn();
    const { rpc, kit } = kitFor(userWith(['email']), { onError });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied', code: '42501' } } as never);
    await expect(kit.deleteAccount('pw', async () => {})).rejects.toMatchObject({ code: 'supabase/42501' });
    expect(onError).toHaveBeenCalledWith('delete-user', expect.any(Error));
  });
  it('the app can supply its own deleteUser (for example an Edge Function)', async () => {
    const deleteUser = vi.fn(async () => {});
    const { rpc, kit } = kitFor(userWith(['google']), { deleteUser });
    await kit.deleteAccount('', async () => {});
    expect(deleteUser).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('sign-in state', () => {
  it('follows the person in and out, and keeps hasPassword current', () => {
    const c = makeClient();
    const kit = createSupabaseAuthKit({ supabase: c.client });
    const set = vi.fn();
    subscribeSupabaseAuth(c.client, true, set);
    expect(set).toHaveBeenLastCalledWith({ status: 'out' });
    c.as(userWith(['email']));
    expect(set).toHaveBeenLastCalledWith({ status: 'in', user: expect.objectContaining({ id: 'u1' }) });
    expect(kit.hasPassword()).toBe(true);
    c.as(null);
    expect(kit.hasPassword()).toBe(false);
  });
  it('a listener that throws counts as signed out and is reported', () => {
    const c = makeClient();
    c.auth.onAuthStateChange.mockImplementation(() => { throw new Error('boom'); });
    const set = vi.fn();
    const onError = vi.fn();
    subscribeSupabaseAuth(c.client, true, set, onError);
    expect(set).toHaveBeenCalledWith({ status: 'out' });
    expect(onError).toHaveBeenCalledWith('auth-state', expect.any(Error));
  });
  it('sign out clears the nickname and the person', async () => {
    const { auth, kit } = kitFor(userWith(['email']));
    await kit.signOut();
    expect(auth.signOut).toHaveBeenCalled();
    expect(kit.hasPassword()).toBe(false);
  });
});

describe('the sign-in screen with the Supabase kit', () => {
  it('signs in through Supabase', async () => {
    const { auth, kit } = kitFor();
    const h = mount(<SignInScreen kit={kit} brand={{ name: 'App' }} />);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'pw');
    await press(h.text(S.signIn)!);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
  });
});
