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
  /** Fill of the text boxes. Defaults to `surface`. */
  field?: string;
  /** The small labels above the text boxes (with `labels`). Defaults to `muted`. */
  label?: string;
  /** The main button's fill when no `brand.button` is drawn. Defaults to `text`. */
  primary?: string;
  /** The main button's words and spinner. Defaults to `bg`. */
  onPrimary?: string;
  /** A soft colored glow under the main button. None by default. */
  glow?: string;
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
  /** The icon on the show/hide password button (with `showPassword`), such as an eye. The default is the word Show or Hide. */
  PasswordEye?: ComponentType<{ visible: boolean }>;
}

export interface AuthBrand {
  name: string;
  tagline?: string;
  /** Drawn at the top, above the name (a logo, an illustration). */
  logo?: ReactNode;
  /** Drawn behind the whole screen (a starfield, a gradient). */
  backdrop?: ReactNode;
  /** Drawn inside the main button, behind its words (a gradient). It fills the button and is clipped to its corners. */
  button?: ReactNode;
}

/** Every piece of wording on the screen, so an app can translate or reword it. */
export interface AuthStrings {
  email: string;
  /** The hint inside the email box when `labels` is on (the label above already says "Email"). */
  emailHint: string;
  password: string;
  /** The hint inside the password box when `labels` is on. */
  passwordHint: (min: number) => string;
  passwordNew: (min: number) => string;
  nickname: string;
  signIn: string;
  createAccount: string;
  google: string;
  googleSignUp: string;
  /**
   * 1.19.0: shown on Android sign-in only, where there is no Apple button, for people who joined with Apple on iPhone.
   * An empty string hides it.
   */
  appleOnAndroid: string;
  apple: string;
  appleSignUp: string;
  or: string;
  haveAccount: string;
  newHere: string;
  forgot: string;
  forgotNeedsEmail: string;
  resetSent: string;
  privacy: string;
  /** The Features link (with `onOpenFeatures`). */
  features: string;
  /** The second password box when creating an account (with `confirmPassword`). */
  confirmPassword: string;
  /** Shown while the two passwords differ. */
  passwordsDiffer: string;
  /** The show/hide password button (with `showPassword`): its words, and what a screen reader says. */
  show: string;
  hide: string;
  showPassword: string;
  hidePassword: string;
}

export const DEFAULT_STRINGS: AuthStrings = {
  email: 'Email',
  emailHint: 'you@example.com',
  password: 'Password',
  passwordHint: (min) => `${min} or more characters`,
  passwordNew: (min) => `Password (${min}+ characters)`,
  nickname: 'Nickname (optional)',
  signIn: 'Sign in',
  createAccount: 'Create account',
  google: 'Continue with Google',
  googleSignUp: 'Sign up with Google',
  appleOnAndroid: 'Joined with Apple on iPhone? Enter your Apple ID email, tap Forgot Password to set a password, then sign in here.',
  apple: 'Continue with Apple',
  appleSignUp: 'Sign up with Apple',
  or: 'or',
  haveAccount: 'Have an account? Sign in',
  newHere: 'New here? Create an account',
  forgot: 'Forgot password?',
  forgotNeedsEmail: 'Enter your email above first, then tap Forgot password.',
  resetSent: 'If that address has an account, a reset email is on its way. Check your inbox, and your spam folder too.',
  privacy: 'Privacy policy',
  features: 'Features',
  confirmPassword: 'Confirm password',
  passwordsDiffer: "The passwords don't match.",
  show: 'Show',
  hide: 'Hide',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
};
