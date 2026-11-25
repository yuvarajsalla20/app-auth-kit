import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthKit } from '../src/session/createAuthKit';
import { createUserMemory, REMEMBERED_USER_KEY, type AuthStorage } from '../src/session/rememberUser';
import type { AuthState } from '../src/types';
import { subscribeAuth } from '../src/session/useAuth';
import { fns, resetSpies } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(resetSpies);

/** A storage that answers asynchronously, like AsyncStorage. */
const memoryStorage = (start: Record<string, string> = {}) => {
  const data = new Map(Object.entries(start));
  const storage: AuthStorage & { data: Map<string, string> } = {
    data,
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
    removeItem: vi.fn(async (k: string) => void data.delete(k)),
  };
  return storage;
};

const ada = { uid: 'u1', email: 'ada@example.com', displayName: 'Ada', photoURL: 'https://p/ada.png', providerData: [{ providerId: 'google.com' }] };
const saved = (u: object = ada) => ({ [REMEMBERED_USER_KEY]: JSON.stringify(u) });
const fakeAuth = { name: '[DEFAULT]', config: { apiKey: 'KEY' }, currentUser: null } as never;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

/** Holds Firebase's listener so a test decides when (and what) Firebase answers. */
const holdFirebase = () => {
  const held: { next?: (u: unknown) => void } = {};
  const stop = vi.fn();
  fns.onAuthStateChanged.mockImplementation((_a, next) => { held.next = next; return stop; });
  return { answer: (u: unknown) => held.next!(u), stop };
};

/** Mounts `useAuth` and records each state it returns. */
const mountHook = (useAuth: (enabled?: boolean) => AuthState) => {
  const seen: AuthState[] = [];
  const Probe = () => {
    seen.push(useAuth());
    return null;
  };
  let root!: TestRenderer.ReactTestRenderer;
  act(() => { root = TestRenderer.create(createElement(Probe)); });
  return { seen, last: () => seen[seen.length - 1], root };
};

describe('remembered user (fast start)', () => {
  it('useAuth returns the remembered person before Firebase answers, then confirms them', async () => {
    const fb = holdFirebase();
    const storage = memoryStorage(saved());
    const kit = createAuthKit({ auth: fakeAuth, storage });
    await flush(); // the kit's read at creation finishes, as it does before an app's first render
    const hook = mountHook(kit.useAuth);
    expect(hook.seen[0]).toEqual({ status: 'in', user: ada, confirming: true });
    expect(fns.onAuthStateChanged).toHaveBeenCalledOnce();
    const real = { ...ada, getIdToken: vi.fn() };
    act(() => fb.answer(real));
    expect(hook.last()).toEqual({ status: 'in', user: real });
    expect(hook.seen.some((s) => s.status === 'loading')).toBe(false);
  });

  it('shows the remembered person as soon as the read finishes when the app renders first', async () => {
    holdFirebase();
    const kit = createAuthKit({ auth: fakeAuth, storage: memoryStorage(saved()) });
    const hook = mountHook(kit.useAuth);
    expect(hook.seen[0]).toEqual({ status: 'loading' });
    await flush();
    expect(hook.last()).toEqual({ status: 'in', user: ada, confirming: true });
  });

  it('switches to out, and forgets the person, when Firebase reports nobody', async () => {
    const fb = holdFirebase();
    const storage = memoryStorage(saved());
    const kit = createAuthKit({ auth: fakeAuth, storage });
    await flush();
    const hook = mountHook(kit.useAuth);
    act(() => fb.answer(null));
    expect(hook.last()).toEqual({ status: 'out' });
    await flush();
    expect(storage.data.has(REMEMBERED_USER_KEY)).toBe(false);
  });

  it('switches to the new person when Firebase reports someone else, and remembers them', async () => {
    const fb = holdFirebase();
    const storage = memoryStorage(saved());
    const kit = createAuthKit({ auth: fakeAuth, storage });
    await flush();
    const hook = mountHook(kit.useAuth);
    const grace = { uid: 'u2', email: 'grace@example.com', displayName: null, photoURL: null, providerData: [{ providerId: 'password' }] };
    act(() => fb.answer(grace));
    expect(hook.last()).toEqual({ status: 'in', user: grace });
    await flush();
    expect(JSON.parse(storage.data.get(REMEMBERED_USER_KEY)!)).toEqual(grace);
  });

  it("a late read never overrides Firebase's answer", async () => {
    const fb = holdFirebase();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const storage = memoryStorage(saved());
    storage.getItem = vi.fn(async (k: string) => { await gate; return storage.data.get(k) ?? null; });
    const kit = createAuthKit({ auth: fakeAuth, storage });
    const hook = mountHook(kit.useAuth);
    act(() => fb.answer(null));
    release();
    await flush();
    expect(hook.last()).toEqual({ status: 'out' });
  });

  it('Sign Out forgets the person, so the next launch waits for Firebase', async () => {
    const fb = holdFirebase();
    const storage = memoryStorage();
    const kit = createAuthKit({ auth: fakeAuth, storage });
    const hook = mountHook(kit.useAuth);
    act(() => fb.answer(ada));
    await flush();
    expect(storage.data.has(REMEMBERED_USER_KEY)).toBe(true);
    await kit.signOut();
    await flush();
    expect(fns.signOut).toHaveBeenCalledOnce();
    expect(storage.data.has(REMEMBERED_USER_KEY)).toBe(false);
    hook.root.unmount();

    const next = createAuthKit({ auth: fakeAuth, storage });
    await flush();
    expect(mountHook(next.useAuth).seen[0]).toEqual({ status: 'loading' });
  });

  it('keeps the remembered person when Sign Out fails', async () => {
    fns.signOut.mockRejectedValue(new Error('offline'));
    const storage = memoryStorage(saved());
    const kit = createAuthKit({ auth: fakeAuth, storage });
    await expect(kit.signOut()).rejects.toThrow('offline');
    await flush();
    expect(storage.data.has(REMEMBERED_USER_KEY)).toBe(true);
  });

  it("falls back to Firebase's own saved login, keeping only the profile fields", async () => {
    const firebaseSaved = { ...ada, stsTokenManager: { refreshToken: 'secret' }, providerData: [{ providerId: 'apple.com', uid: 'x' }] };
    const memory = createUserMemory(fakeAuth, memoryStorage({ 'firebase:authUser:KEY:[DEFAULT]': JSON.stringify(firebaseSaved) }));
    expect(await memory.load()).toEqual({ ...ada, providerData: [{ providerId: 'apple.com' }] });
  });

  it('treats unreadable or broken saved data as nobody, and reports a storage failure', async () => {
    expect(await createUserMemory(fakeAuth, memoryStorage({ [REMEMBERED_USER_KEY]: '{oops' })).load()).toBeNull();
    expect(await createUserMemory(fakeAuth, memoryStorage({ [REMEMBERED_USER_KEY]: '{"email":"a@b.com"}' })).load()).toBeNull();
    const onError = vi.fn();
    const broken = memoryStorage();
    broken.getItem = vi.fn(async () => { throw new Error('disk'); });
    expect(await createUserMemory(fakeAuth, broken, onError).load()).toBeNull();
    expect(onError).toHaveBeenCalledWith('remember-user', expect.any(Error));
  });

  it('writes only when the person changes', async () => {
    const storage = memoryStorage(saved());
    const memory = createUserMemory(fakeAuth, storage);
    await memory.load();
    memory.remember({ ...ada, getIdToken: vi.fn() } as never);
    await flush();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('without storage, useAuth waits for Firebase as before', () => {
    holdFirebase();
    const kit = createAuthKit({ auth: fakeAuth });
    expect(mountHook(kit.useAuth).seen[0]).toEqual({ status: 'loading' });
  });

  it('turned off, it is signed out even with a remembered person', async () => {
    const memory = createUserMemory(fakeAuth, memoryStorage(saved()));
    await memory.load();
    const set = vi.fn();
    subscribeAuth(fakeAuth, false, set, undefined, memory);
    expect(set).toHaveBeenCalledWith({ status: 'out' });
    expect(set).toHaveBeenCalledOnce();
  });
});
