import { FALLBACK_MESSAGE, NO_CONNECTION_MESSAGE } from 'app-core-kit';

export { FALLBACK_MESSAGE };

/** Plain-language text for the Firebase errors people actually meet. An empty string means "say nothing". */
export const DEFAULT_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-credential': 'Email or password is not correct.',
  'auth/wrong-password': 'Email or password is not correct.',
  'auth/user-not-found': 'Email or password is not correct.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/wrong-current-password': 'Your current password is not correct.',
  'auth/no-password': 'This account signs in without a password, so there is none to change.',
  'auth/requires-recent-login': 'For safety, sign out, sign in again, then retry.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': NO_CONNECTION_MESSAGE,
  // Database (Firestore) errors that can surface while erasing an account.
  unavailable: NO_CONNECTION_MESSAGE,
  'deadline-exceeded': NO_CONNECTION_MESSAGE,
  'auth/delete-timeout': 'Deleting is taking too long and may still finish. Check your connection, then try again.',
  'auth/reset-cooldown': 'We just sent a link. Wait a minute before asking for another.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled': '',
  'auth/missing-token': 'Sign-in did not finish. Please try again.',
  'auth/operation-not-allowed': 'This sign-in method is not switched on yet. Please contact support.',
  'auth/account-exists-with-different-credential': 'This email already has an account with another sign-in method. Use that one.',
  'auth/cancelled-popup-request': '',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The app is not set up correctly (API key). Please contact support.',
};

