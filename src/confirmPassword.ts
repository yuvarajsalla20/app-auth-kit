import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth';
import { codeOf, coded } from './errors';

/** Signs the person in again with their password. A wrong one says so plainly instead of "Email or password is not correct". */
export const confirmPassword = async (user: User, email: string, password: string): Promise<void> => {
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));
  } catch (e) {
    const code = codeOf(e);
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') throw coded('Wrong current password.', 'auth/wrong-current-password');
    throw e;
  }
};
