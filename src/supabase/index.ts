// app-auth-kit/supabase: the same kit on Supabase Auth. Imports nothing from Firebase.
export { KIT_NAME, KIT_VERSION } from '../kit';
export { createSupabaseAuthKit } from './createSupabaseAuthKit';
export type { SupabaseAuthKit } from './createSupabaseAuthKit';
export type { AppleResult, NativeProviders, SupabaseAuthKitOptions, SupabaseAuthState } from './types';
export { fromSupabase } from './errors';
export { SUPABASE_MESSAGES } from './messages';
export { SignInScreen } from '../SignInScreen';
export type { SignInScreenProps } from '../SignInScreen';
export type { ScreenKit } from '../screenKit';
export { DEFAULT_MESSAGES } from '../messages';
export { DEFAULT_STRINGS, DEFAULT_THEME } from '../theme';
export type { AuthBrand, AuthComponents, AuthStrings, AuthTheme } from '../theme';
