import type { NativeProviders } from '../shared/providerTypes';

export interface ExpoNativeOptions {
  /** The iOS client ID from Google Cloud. Leave it out (or empty) to hide Google on iPhone until it is set up. */
  googleIosClientId?: string;
  /**
   * The Web client ID from Google Cloud, for Google on Android (Android has no client ID of its own here: the Web one
   * makes Google return a token Firebase and Supabase accept). Leave it out (or empty) to hide Google on Android.
   */
  googleWebClientId?: string;
  /** Turn Apple off. Default on, as App Review expects whenever Google is offered. iPhone only. */
  apple?: boolean;
  /** The platform, from `Platform.OS`. Sheets are offered on iPhone and Android; the web uses the kit's own popups. */
  os: string;
  /**
   * Called when Google's sheet fails (not when the person cancels), before the error is passed on, so the app can
   * report it. `extra` says which platform and which Web client ID the build carries (only its first part, which is
   * the project number), since a wrong ID or fingerprint is the usual cause on Android (Google's code 10).
   */
  onError?: (where: string, error: unknown, extra: Record<string, string | number>) => void;
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

type GoogleConfig = { iosClientId: string } | { webClientId: string };

/** Loads Google's module and sets it up for this phone. Android needs this before any call, Sign Out included. */
const googleSignin = async (config: GoogleConfig) => {
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure(config);
  return GoogleSignin;
};

const google = (config: GoogleConfig, report: (error: unknown) => void): NonNullable<NativeProviders['google']> => async () => {
  const GoogleSignin = await googleSignin(config);
  let result: Awaited<ReturnType<typeof GoogleSignin.signIn>>;
  try {
    result = await GoogleSignin.signIn();
  } catch (e) {
    report(e);
    throw e;
  }
  if (result.type !== 'success') return null;
  if (!result.data.idToken) throw missingToken();
  return result.data.idToken;
};

/** Google keeps the last account on the phone; signing out of it makes the next Google sign-in ask which account. */
const googleSignOut = (config: GoogleConfig) => async (): Promise<void> => {
  await (await googleSignin(config)).signOut();
};

/**
 * The phone's own sign-in sheets, ready made for an Expo app: pass the result as `createAuthKit({ native })`.
 * iPhone: Apple, and Google once `googleIosClientId` is set. Android: Google only (Apple has no sheet there), once
 * `googleWebClientId` is set. Elsewhere (the web) nothing: the kit uses its own popups.
 * Sign Out (and a finished Delete Account) also signs the phone out of Google, so the next person picks their own account.
 * The native modules load only when a button is tapped, and each sheet returns null when the person cancels.
 * Needs `expo-apple-authentication` and `expo-crypto` (Apple) and `@react-native-google-signin/google-signin` (Google) in the app.
 * On iPhone, also apply the kit's Google presenter fix (README, "Google on iPhone").
 */
export const expoNativeProviders = ({ googleIosClientId, googleWebClientId, apple: withApple = true, os, onError }: ExpoNativeOptions): NativeProviders => {
  const config: GoogleConfig | null =
    os === 'ios' ? (googleIosClientId ? { iosClientId: googleIosClientId } : null) : os === 'android' ? (googleWebClientId ? { webClientId: googleWebClientId } : null) : null;
  const report = (error: unknown) =>
    onError?.('google-sign-in', error, { os, webClientId: googleWebClientId?.split('-')[0] || 'missing', webClientIdLength: googleWebClientId?.length ?? 0 });
  const googleParts = config ? { google: google(config, report), signOut: googleSignOut(config) } : {};
  if (os === 'ios') return { apple: withApple ? apple : undefined, google: undefined, signOut: undefined, ...googleParts };
  if (os === 'android') return { ...googleParts };
  return {};
};
