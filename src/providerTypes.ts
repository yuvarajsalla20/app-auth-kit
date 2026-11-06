// Shared by the Firebase and Supabase kits. No backend imports here.

/** What Apple hands back. `rawNonce` is the unhashed value whose SHA-256 was sent to Apple. */
export interface AppleResult {
  idToken: string;
  rawNonce: string;
  /** Needed to revoke Apple's access when the account is deleted. */
  authorizationCode?: string | null;
}

/**
 * The phone's own sign-in sheets, supplied by the app so this package needs no native modules.
 * Each returns null when the person cancels, and throws on a real failure.
 */
export interface NativeProviders {
  /** Returns a Google ID token. */
  google?: () => Promise<string | null>;
  apple?: () => Promise<AppleResult | null>;
}
