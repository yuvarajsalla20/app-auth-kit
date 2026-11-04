import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type Auth } from 'firebase/auth';
import { codeOf, coded } from './errors';
import { checkNewPassword } from './passwordRules';
import type { Providers } from './providers';

interface Deps {
  requireAuth: () => Auth;
  providers: Providers;
  minPassword: number;
  sendReset: (email: string) => Promise<void>;
}

/** The two "Change password" paths: an emailed link, or the current password confirmed on the spot. */
export const createPasswordActions = ({ requireAuth, providers, minPassword, sendReset }: Deps) => ({
  /** Emails a reset link to the signed-in person's own address. */
  sendPasswordChange: async (): Promise<void> => {
    const email = requireAuth().currentUser?.email;
    if (!email) throw coded('No email on this account.', 'auth/invalid-email');
    if (!providers.hasPassword()) throw coded('No password on this account.', 'auth/no-password');
    return sendReset(email);
  },

  /**
   * Changes the signed-in person's password: confirms the current one first (Firebase refuses a change after an old
   * sign-in), then sets the new one. A wrong current password says so plainly instead of "Email or password is not correct".
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const user = requireAuth().currentUser;
    if (!user?.email || !providers.hasPassword()) throw coded('No password on this account.', 'auth/no-password');
    checkNewPassword(minPassword, newPassword, currentPassword);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    } catch (e) {
      const code = codeOf(e);
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') throw coded('Wrong current password.', 'auth/wrong-current-password');
      throw e;
    }
    await updatePassword(user, newPassword);
  },
});
