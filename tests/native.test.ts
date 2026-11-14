import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expoNativeProviders } from '../src/native/providers';

const apple = { signInAsync: vi.fn() };
const google = { configure: vi.fn(), signIn: vi.fn() };

vi.mock('expo-apple-authentication', () => ({ AppleAuthenticationScope: { EMAIL: 1 }, signInAsync: (...a: unknown[]) => apple.signInAsync(...a) }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'sha' }, randomUUID: () => 'raw', digestStringAsync: async (_: string, s: string) => `hash(${s})` }));
vi.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: google }));

beforeEach(() => {
  apple.signInAsync.mockReset();
  google.signIn.mockReset();
  google.configure.mockReset();
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
});
