import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthKit } from '../src/createAuthKit';
import { authWith, fail, fns, resetSpies } from './helpers';

beforeEach(resetSpies);
const kit = () => createAuthKit({ auth: authWith(['password']), minPassword: 8 });

describe('changePassword', () => {
  it('refuses a short new password before asking Firebase', async () => {
    await expect(kit().changePassword('old-password', 'abc123')).rejects.toMatchObject({ code: 'auth/weak-password' });
    expect(fns.reauthenticateWithCredential).not.toHaveBeenCalled();
  });
  it('refuses the same password', async () => {
    await expect(kit().changePassword('same-password', 'same-password')).rejects.toMatchObject({ code: 'auth/same-password' });
  });
  it('says plainly when the current password is wrong', async () => {
    fns.reauthenticateWithCredential.mockRejectedValue(fail('auth/invalid-credential'));
    await expect(kit().changePassword('wrong-one', 'new-password1')).rejects.toMatchObject({ code: 'auth/wrong-current-password' });
    expect(fns.updatePassword).not.toHaveBeenCalled();
  });
  it('sets the new password after confirming the old one', async () => {
    await kit().changePassword('old-password', 'new-password1');
    expect(fns.updatePassword).toHaveBeenCalledTimes(1);
  });
  it('explains an account that has no password', async () => {
    const k = createAuthKit({ auth: authWith(['apple.com']) });
    await expect(k.changePassword('a', 'b-password1')).rejects.toMatchObject({ code: 'auth/no-password' });
  });
});

describe('sendPasswordChange', () => {
  it('reports a missing password as a rejected promise, not a thrown error', async () => {
    const k = createAuthKit({ auth: authWith(['google.com']) });
    await expect(k.sendPasswordChange()).rejects.toMatchObject({ code: 'auth/no-password' });
    expect(fns.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
  it('emails the signed-in address', async () => {
    await kit().sendPasswordChange();
    expect(fns.sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'a@b.com');
  });
});
