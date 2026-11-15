// `app-auth-kit/native`: the phone parts an Expo app would otherwise write itself. Kept apart from the main entry,
// so an app (or the web build) that does not use them never needs the native modules.
export { expoNativeProviders, type ExpoNativeOptions } from './providers';
export { APPLE_BUTTON, AppleButton, makeAppleButton, type AppleButtonProps } from './AppleButton';
