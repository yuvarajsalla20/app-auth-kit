import type { ComponentProps, ComponentType, ReactNode } from 'react';
import type { Text as RNText, TextInput as RNTextInput } from 'react-native';

/** Colors the sign-in screen uses. Pass only what differs from the defaults. */
export interface AuthTheme {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  danger: string;
}

export const DEFAULT_THEME: AuthTheme = {
  bg: '#0B0B0C',
  surface: '#141416',
  border: '#232326',
  text: '#F5F5F7',
  muted: '#9A9AA0',
  accent: '#5B8CFF',
  danger: '#FF8A80',
};

/** The app's own text components, so the screen picks up its fonts. Plain React Native ones are the default. */
export interface AuthComponents {
  Text: ComponentType<ComponentProps<typeof RNText>>;
  TextInput: ComponentType<ComponentProps<typeof RNTextInput>>;
  /** Apple's own button (it must follow Apple's design rules). The default is a plain white button. */
  AppleButton: ComponentType<{ signUp: boolean; disabled: boolean; onPress: () => void }>;
}

export interface AuthBrand {
  name: string;
  tagline?: string;
  /** Drawn at the top, above the name (a logo, an illustration). */
  logo?: ReactNode;
  /** Drawn behind the whole screen (a starfield, a gradient). */
  backdrop?: ReactNode;
}

/** Every piece of wording on the screen, so an app can translate or reword it. */
export interface AuthStrings {
  email: string;
  password: string;
  passwordNew: (min: number) => string;
  nickname: string;
  signIn: string;
  createAccount: string;
  google: string;
  googleSignUp: string;
  apple: string;
  appleSignUp: string;
  or: string;
  haveAccount: string;
  newHere: string;
  forgot: string;
  forgotNeedsEmail: string;
  resetSent: string;
  privacy: string;
}

export const DEFAULT_STRINGS: AuthStrings = {
  email: 'Email',
  password: 'Password',
  passwordNew: (min) => `Password (${min}+ characters)`,
  nickname: 'Nickname (optional)',
  signIn: 'Sign in',
  createAccount: 'Create account',
  google: 'Continue with Google',
  googleSignUp: 'Sign up with Google',
  apple: 'Continue with Apple',
  appleSignUp: 'Sign up with Apple',
  or: 'or',
  haveAccount: 'Have an account? Sign in',
  newHere: 'New here? Create an account',
  forgot: 'Forgot password?',
  forgotNeedsEmail: 'Enter your email above first, then tap Forgot password.',
  resetSent: 'If that address has an account, a reset email is on its way. Check your inbox, and your spam folder too.',
  privacy: 'Privacy policy',
};
