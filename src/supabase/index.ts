// app-auth-kit/supabase: the same kit on Supabase Auth. Imports nothing from Firebase.
export { KIT_NAME, KIT_VERSION } from '../kit';
export { createSupabaseAuthKit } from './createSupabaseAuthKit';
export { createDeleteAccountFlow } from '../delete-account/deleteAccountFlow';
export type { DeleteAccountFlow, DeleteAccountFlowSteps, RestoreInfo } from '../delete-account/deleteAccountFlow';
export type { SupabaseAuthKit } from './createSupabaseAuthKit';
export type { AppleResult, NativeProviders, SupabaseAuthKitOptions, SupabaseAuthState } from './types';
export { fromSupabase } from './errors';
export { SUPABASE_MESSAGES } from './messages';
export { SignInScreen } from '../sign-in/SignInScreen';
export type { SignInScreenProps } from '../sign-in/SignInScreen';
export type { ScreenKit } from '../sign-in/screenKit';
export { DEFAULT_MESSAGES } from '../shared/messages';
export { DEFAULT_STRINGS, DEFAULT_THEME } from '../sign-in/theme';
export type { AuthBrand, AuthComponents, AuthStrings, AuthTheme } from '../sign-in/theme';
