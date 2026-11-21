// Compile-time checks (run by `npm run typecheck`): both kits fit the sign-in screen and keep the same action signatures.
import type { AuthKit } from '../src/createAuthKit';
import { createDeleteAccountFlow, type DeleteAccountFlowSteps } from '../src/deleteAccountFlow';
import type { ScreenKit } from '../src/screenKit';
import type { SupabaseAuthKit } from '../supabase';

export const firebaseFitsScreen = (k: AuthKit): ScreenKit => k;
export const supabaseFitsScreen = (k: SupabaseAuthKit): ScreenKit => k;

/** What app-account-kit and the apps call on a kit; the Supabase kit must offer each one in the same shape. */
type Shared = Pick<AuthKit, 'hasPassword' | 'confirmsWithPassword' | 'takeNickname' | 'sendPasswordChange' | 'changePassword' | 'deleteAccount' | 'sendPasswordReset' | 'message'>;
export const supabaseSharesActions = (k: SupabaseAuthKit): Shared => k;
export const supabaseSignOut = (k: SupabaseAuthKit): (() => Promise<void>) => k.signOut;

// The shared Delete Account flow takes either kit's deleteAccount; with no context it is called with the password alone.
export const firebaseFitsFlow = (k: AuthKit): DeleteAccountFlowSteps['deleteAccount'] => k.deleteAccount;
export const supabaseFitsFlow = (k: SupabaseAuthKit): DeleteAccountFlowSteps<string>['deleteAccount'] => k.deleteAccount;
export const flowWithoutContext = (k: AuthKit): Promise<void> =>
  createDeleteAccountFlow({ deleteAccount: k.deleteAccount, erase: async () => {}, restore: async () => {} })('pw');
export const flowWithContext = (k: AuthKit): Promise<void> =>
  createDeleteAccountFlow<string>({ deleteAccount: k.deleteAccount, erase: async (uid) => void uid.length, restore: async () => {} })('pw', 'u1');
