/** Plain-language text for the Firebase errors people actually meet. An empty string means "say nothing". */
export const DEFAULT_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-credential': 'Email or password is not correct.',
  'auth/wrong-password': 'Email or password is not correct.',
  'auth/user-not-found': 'Email or password is not correct.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/requires-recent-login': 'For safety, sign out, sign in again, then retry.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The app is not set up correctly (API key). Please contact support.',
};

export const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
