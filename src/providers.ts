import { GoogleAuthProvider, OAuthProvider, type Auth, type AuthCredential } from 'firebase/auth';
import { coded } from './errors';
import type { NativeProviders } from './types';

/** Which sign-in methods the current person uses, and the credentials the phone's sheets hand back. */
export const createProviders = (auth: Auth | null, native: NativeProviders) => {
  const cancelled = () => coded('cancelled', 'auth/cancelled');
  const hasProvider = (id: string): boolean => !!auth?.currentUser?.providerData.some((p) => p.providerId === id);
  const hasPassword = (): boolean => hasProvider('password');
  return {
    hasProvider,
    hasPassword,
    // Sign in with Apple wins when it is linked, even if the account also has a password: that is the only way to get the code Apple needs to revoke.
    usesApple: (): boolean => !!native.apple && hasProvider('apple.com'),
    googleCredential: async (): Promise<AuthCredential> => {
      const idToken = await native.google!();
      if (!idToken) throw cancelled();
      return GoogleAuthProvider.credential(idToken);
    },
    appleCredential: async (): Promise<{ credential: AuthCredential; code?: string | null }> => {
      const result = await native.apple!();
      if (!result) throw cancelled();
      return { credential: new OAuthProvider('apple.com').credential({ idToken: result.idToken, rawNonce: result.rawNonce }), code: result.authorizationCode };
    },
  };
};
export type Providers = ReturnType<typeof createProviders>;
