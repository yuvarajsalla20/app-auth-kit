import type { NativeProviders } from '../providerTypes';

export interface ExpoNativeOptions {
  /** The iOS client ID from Google Cloud. Leave it out (or empty) to hide Google until it is set up. */
  googleIosClientId?: string;
  /** Turn Apple off. Default on, as App Review expects whenever Google is offered. */
  apple?: boolean;
  /** The platform, from `Platform.OS`. Sign-in sheets are offered on iPhone only; the web uses the kit's own popups. */
  os: string;
}

/** Signing in worked but gave no token: a failure to show, not a cancel to hide. */
const missingToken = () => Object.assign(new Error('No identity token'), { code: 'auth/missing-token' });

/** Apple's own sheet. Apple gets the hashed nonce and Firebase the raw one: together they prove the token was made for this sign-in. */
const apple: NonNullable<NativeProviders['apple']> = async () => {
  const AppleAuthentication = await import('expo-apple-authentication');
  const Crypto = await import('expo-crypto');
  const rawNonce = Crypto.randomUUID();
  const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const result = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce });
    if (!result.identityToken) throw missingToken();
    return { idToken: result.identityToken, rawNonce, authorizationCode: result.authorizationCode };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
};

const google = (iosClientId: string): NonNullable<NativeProviders['google']> => async () => {
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ iosClientId });
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') return null;
  if (!result.data.idToken) throw missingToken();
  return result.data.idToken;
};

/**
 * The iPhone's own Apple and Google sign-in sheets, ready made for an Expo app: pass the result as `createAuthKit({ native })`.
 * The native modules load only when a button is tapped, and each sheet returns null when the person cancels.
 * Needs `expo-apple-authentication` and `expo-crypto` (Apple) and `@react-native-google-signin/google-signin` (Google) in the app.
 */
export const expoNativeProviders = ({ googleIosClientId, apple: withApple = true, os }: ExpoNativeOptions): NativeProviders =>
  os === 'ios' ? { apple: withApple ? apple : undefined, google: googleIosClientId ? google(googleIosClientId) : undefined } : {};
