/**
 * The part of a kit the sign-in screen uses. Both kits fit it: `createAuthKit` (Firebase) and
 * `createSupabaseAuthKit` (`app-auth-kit/supabase`). Type only: nothing here runs.
 */
export interface ScreenKit {
  google: boolean;
  apple: boolean;
  minPassword: number;
  maxNickname: number;
  message: (error: unknown) => string;
  signInEmail: (email: string, password: string) => Promise<unknown>;
  signUpEmail: (email: string, password: string, nickname?: string) => Promise<unknown>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInApple: () => Promise<unknown>;
  signInGoogle: () => Promise<unknown>;
}
