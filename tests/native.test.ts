import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expoNativeProviders } from '../src/native/providers';

const apple = { signInAsync: vi.fn() };
const google = { configure: vi.fn(), signIn: vi.fn(), signOut: vi.fn(async () => {}) };

vi.mock('expo-apple-authentication', () => ({ AppleAuthenticationScope: { EMAIL: 1 }, signInAsync: (...a: unknown[]) => apple.signInAsync(...a) }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'sha' }, randomUUID: () => 'raw', digestStringAsync: async (_: string, s: string) => `hash(${s})` }));
vi.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: google }));

beforeEach(() => {
  apple.signInAsync.mockReset();
  google.signIn.mockReset();
  google.configure.mockReset();
  google.signOut.mockClear();
});

describe('expoNativeProviders', () => {
  it('offers the sheets on iPhone only, and Google only once its client ID is set', () => {
    expect(expoNativeProviders({ os: 'web', googleIosClientId: 'g' })).toEqual({});
    const noGoogle = expoNativeProviders({ os: 'ios' });
    expect(noGoogle.apple).toBeTypeOf('function');
    expect(noGoogle.google).toBeUndefined();
    expect(expoNativeProviders({ os: 'ios', googleIosClientId: 'g', apple: false }).apple).toBeUndefined();
  });

  it('Apple: sends the hashed nonce, returns the raw one, and null on cancel', async () => {
    const { apple: signIn } = expoNativeProviders({ os: 'ios' });
    apple.signInAsync.mockResolvedValue({ identityToken: 'tok', authorizationCode: 'code' });
    expect(await signIn!()).toEqual({ idToken: 'tok', rawNonce: 'raw', authorizationCode: 'code' });
    expect(apple.signInAsync).toHaveBeenCalledWith({ requestedScopes: [1], nonce: 'hash(raw)' });
    apple.signInAsync.mockRejectedValue(Object.assign(new Error('x'), { code: 'ERR_REQUEST_CANCELED' }));
    expect(await signIn!()).toBeNull();
    apple.signInAsync.mockResolvedValue({ identityToken: null });
    await expect(signIn!()).rejects.toMatchObject({ code: 'auth/missing-token' });
  });

  it('Google: configures the client, returns the token, and null on cancel', async () => {
    const { google: signIn } = expoNativeProviders({ os: 'ios', googleIosClientId: 'client' });
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'gtok' } });
    expect(await signIn!()).toBe('gtok');
    expect(google.configure).toHaveBeenCalledWith({ iosClientId: 'client' });
    google.signIn.mockResolvedValue({ type: 'cancelled' });
    expect(await signIn!()).toBeNull();
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: null } });
    await expect(signIn!()).rejects.toMatchObject({ code: 'auth/missing-token' });
  });

  it('Sign Out forgets the Google account only when Google is set up', async () => {
    expect(expoNativeProviders({ os: 'ios' }).signOut).toBeUndefined();
    await expoNativeProviders({ os: 'ios', googleIosClientId: 'g' }).signOut!();
    expect(google.signOut).toHaveBeenCalledOnce();
  });

  it('Android: Google with the Web client ID, never Apple, and nothing until the ID is set', async () => {
    expect(expoNativeProviders({ os: 'android' })).toEqual({});
    expect(expoNativeProviders({ os: 'android', googleIosClientId: 'ios-only' })).toEqual({});
    const p = expoNativeProviders({ os: 'android', googleWebClientId: '123-web' });
    expect(p.apple).toBeUndefined();
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'atok' } });
    expect(await p.google!()).toBe('atok');
    expect(google.configure).toHaveBeenCalledWith({ webClientId: '123-web' });
    google.signIn.mockResolvedValue({ type: 'cancelled' });
    expect(await p.google!()).toBeNull();
  });

  it('Android: Sign Out configures Google first (Android refuses it otherwise) and forgets the account', async () => {
    const { signOut } = expoNativeProviders({ os: 'android', googleWebClientId: '123-web' });
    await signOut!();
    expect(google.configure).toHaveBeenCalledWith({ webClientId: '123-web' });
    expect(google.signOut).toHaveBeenCalledOnce();
    expect(google.configure.mock.invocationCallOrder[0]).toBeLessThan(google.signOut.mock.invocationCallOrder[0]);
  });

  it('a failed Google sheet is reported with the platform and the Web client ID prefix, then passed on', async () => {
    const onError = vi.fn();
    const boom = Object.assign(new Error('DEVELOPER_ERROR'), { code: '10' });
    google.signIn.mockRejectedValue(boom);
    await expect(expoNativeProviders({ os: 'android', googleWebClientId: '123-web.apps', onError }).google!()).rejects.toBe(boom);
    expect(onError).toHaveBeenCalledWith('google-sign-in', boom, { os: 'android', webClientId: '123', webClientIdLength: 12 });
    await expect(expoNativeProviders({ os: 'ios', googleIosClientId: 'g', onError }).google!()).rejects.toBe(boom);
    expect(onError).toHaveBeenLastCalledWith('google-sign-in', boom, { os: 'ios', webClientId: 'missing', webClientIdLength: 0 });
    google.signIn.mockResolvedValue({ type: 'cancelled' });
    onError.mockClear();
    await expoNativeProviders({ os: 'android', googleWebClientId: '1-w', onError }).google!();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('Google presenter fix (iPhone)', () => {
  const dir = resolve(__dirname, '../patches');
  const file = readdirSync(dir).find((f) => f.startsWith('@react-native-google-signin+google-signin+'))!;
  it('ships with the package', () => {
    expect(file).toBeTruthy();
    expect(JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')).files).toContain('patches');
  });
  it('applies cleanly to the Google sign-in version the kit is tested with', () => {
    const version = JSON.parse(readFileSync(resolve(__dirname, '../node_modules/@react-native-google-signin/google-signin/package.json'), 'utf8')).version;
    expect(file).toBe(`@react-native-google-signin+google-signin+${version}.patch`);
    // Throws when the patch no longer fits the library's source.
    execFileSync('git', ['apply', '--check', resolve(dir, file)], { cwd: resolve(__dirname, '..') });
    expect(readFileSync(resolve(dir, file), 'utf8')).toMatch(/RNGSFallbackPresenter/);
  });
});
