import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthKit } from '../src/createAuthKit';
import { createDeleteAccountFlow, type DeleteAccountFlowSteps } from '../src/deleteAccountFlow';
import { createDeleteAccountFlow as fromSupabaseEntry } from '../supabase';
import { authWith, deferred, fail, fns, resetSpies } from './helpers';

beforeEach(resetSpies);

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** The steps as HringNring passes them (its context is the user ID), with stand-ins that write down what ran. */
const steps = (over: Partial<DeleteAccountFlowSteps<string>> = {}) => {
  const calls: string[] = [];
  const mark = (name: string) => async (uid: string) => void calls.push(`${name}:${uid}`);
  const report = vi.fn();
  return {
    calls,
    report,
    flow: createDeleteAccountFlow<string>({
      deleteAccount: async (_p, erase) => {
        await erase();
        calls.push('login-removed');
      },
      erase: mark('erase'),
      restore: mark('restore'),
      marker: { set: mark('mark'), clear: mark('unmark') },
      cleanups: [
        ['forget-local', mark('forget')],
        ['stop-alerts', mark('alerts')],
      ],
      report,
      restoreWaitMs: 50,
      ...over,
    }),
  };
};

// Brought over from HringNring's tests/deleteAccountFlow.test.ts, where this sequence used to live.
describe('delete account flow', () => {
  it('erases, removes the login, then clears this phone and its alerts', async () => {
    const { flow, calls } = steps();
    await flow('pw', 'u1');
    expect(calls).toEqual(['mark:u1', 'erase:u1', 'login-removed', 'forget:u1', 'alerts:u1', 'unmark:u1']);
  });
  it('puts the backup back and passes the error on when the login cannot be removed', async () => {
    const { flow, calls } = steps({
      deleteAccount: async (_p, erase) => {
        await erase();
        throw new Error('requires-recent-login');
      },
    });
    await expect(flow('pw', 'u1')).rejects.toThrow('requires-recent-login');
    expect(calls).toEqual(['mark:u1', 'erase:u1', 'restore:u1', 'unmark:u1']);
  });
  it('does not call it a failure when only the clean-up after the login is gone fails', async () => {
    const { flow, calls, report } = steps({ cleanups: [['forget-local', async () => Promise.reject(new Error('storage'))], ['stop-alerts', async () => void calls.push('alerts')]] });
    await expect(flow('pw', 'u1')).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledWith('forget-local', expect.any(Error));
    expect(calls).toContain('alerts');
    expect(calls.some((c) => c.startsWith('restore'))).toBe(false);
  });
});

describe('delete account flow: what the apps did differently', () => {
  it('a failure before the erase (wrong password, cancelled sheet) puts nothing back and leaves no note', async () => {
    const { flow, calls } = steps({ deleteAccount: async () => Promise.reject(fail('auth/wrong-current-password')) });
    await expect(flow('bad', 'u1')).rejects.toMatchObject({ code: 'auth/wrong-current-password' });
    expect(calls).toEqual([]);
  });
  it('a failed erase is put back too (it may have got part way)', async () => {
    const { flow, calls } = steps({ erase: async () => Promise.reject(new Error('offline')) });
    await expect(flow('pw', 'u1')).rejects.toThrow('offline');
    expect(calls).toEqual(['mark:u1', 'restore:u1', 'unmark:u1']);
  });
  it('a time-out is put back at once, while the erase still runs; the note stays until that erase has ended', async () => {
    const gate = deferred();
    const restore = vi.fn(async () => {});
    const { flow, calls } = steps({
      deleteAccount: async (_p, erase) => {
        erase().catch(() => {});
        await tick(5);
        throw fail('auth/delete-timeout');
      },
      erase: () => gate.promise,
      restore,
    });
    await expect(flow('pw', 'u1')).rejects.toMatchObject({ code: 'auth/delete-timeout' });
    expect(restore).toHaveBeenCalledWith('u1', expect.objectContaining({ timedOut: true, eraseFinished: false }));
    let ended = false;
    void (restore.mock.calls[0] as unknown as [string, { erasing: Promise<void> }])[1].erasing.then(() => (ended = true));
    await tick();
    expect(ended).toBe(false);
    expect(calls).not.toContain('unmark:u1');
    gate.reject(new Error('erase cancelled'));
    await tick();
    expect(ended).toBe(true);
    expect(calls).toContain('unmark:u1');
  });
  it('tells restore when the erase had finished (only the login removal failed)', async () => {
    const restore = vi.fn(async () => {});
    const { flow } = steps({
      deleteAccount: async (_p, erase) => {
        await erase();
        throw fail('auth/network-request-failed');
      },
      restore,
    });
    await expect(flow('pw', 'u1')).rejects.toBeTruthy();
    expect(restore).toHaveBeenCalledWith('u1', expect.objectContaining({ timedOut: false, eraseFinished: true }));
  });
  it('a failed restore is reported and the note stays, so the next launch sends the data up again', async () => {
    const { flow, calls, report } = steps({
      deleteAccount: async (_p, erase) => {
        await erase();
        throw new Error('no');
      },
      restore: async () => Promise.reject(new Error('restore failed')),
    });
    await expect(flow('pw', 'u1')).rejects.toThrow('no');
    expect(report).toHaveBeenCalledWith('delete-restore', expect.any(Error));
    expect(calls).not.toContain('unmark:u1');
  });
  it('a note that cannot be written stops the delete before anything is erased', async () => {
    const erase = vi.fn();
    const restore = vi.fn();
    const { flow } = steps({ marker: { set: async () => Promise.reject(new Error('disk full')), clear: vi.fn() }, erase, restore });
    await expect(flow('pw', 'u1')).rejects.toThrow('disk full');
    expect(erase).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });
  it('a time-out while the note is still being written erases nothing afterwards', async () => {
    const gate = deferred();
    const erase = vi.fn();
    const restore = vi.fn();
    const { flow } = steps({
      deleteAccount: async (_p, run) => {
        run().catch(() => {});
        await tick(5);
        throw fail('auth/delete-timeout');
      },
      marker: { set: () => gate.promise, clear: vi.fn() },
      erase,
      restore,
    });
    await expect(flow('pw', 'u1')).rejects.toMatchObject({ code: 'auth/delete-timeout' });
    gate.resolve();
    await tick();
    expect(erase).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });
  it('the screen waits for a slow restore only so long; the restore goes on and a new try waits for it', async () => {
    const restoreGate = deferred();
    const order: string[] = [];
    let tries = 0;
    const { flow } = steps({
      deleteAccount: async (_p, erase) => {
        tries += 1;
        await erase();
        if (tries === 1) throw new Error('first try fails');
        order.push('login-removed');
      },
      erase: async () => void order.push('erase'),
      restore: async () => {
        await restoreGate.promise;
        order.push('restored');
      },
      restoreWaitMs: 30,
    });
    const started = Date.now();
    await expect(flow('pw', 'u1')).rejects.toThrow('first try fails');
    expect(Date.now() - started).toBeLessThan(500);
    expect(order).toEqual(['erase']);
    const retry = flow('pw', 'u1');
    await tick(5);
    restoreGate.resolve();
    await retry;
    expect(order).toEqual(['erase', 'restored', 'erase', 'login-removed']);
  });
  it('a new try while an earlier restore is still going after the wait says a delete is in progress', async () => {
    const { flow } = steps({
      deleteAccount: async (_p, erase) => {
        await erase();
        throw new Error('fails');
      },
      restore: () => new Promise(() => {}),
      restoreWaitMs: 20,
    });
    await expect(flow('pw', 'u1')).rejects.toThrow('fails');
    await expect(flow('pw', 'u1')).rejects.toMatchObject({ code: 'auth/delete-in-progress' });
  });
  it('works with no note, no clean-ups and no context (Moonpenny style)', async () => {
    const order: string[] = [];
    const flow = createDeleteAccountFlow({
      deleteAccount: async (_p, erase) => {
        await erase();
        order.push('login');
      },
      erase: async () => void order.push('erase'),
      restore: async () => void order.push('restore'),
    });
    await flow('pw');
    expect(order).toEqual(['erase', 'login']);
  });
  it('is exported from app-auth-kit/supabase too', () => {
    expect(fromSupabaseEntry).toBe(createDeleteAccountFlow);
  });
});

describe('delete account flow with the Firebase kit', () => {
  it('a delete that timed out is put back; the retry waits for that erase to end, then erases again and finishes', async () => {
    const kit = createAuthKit({ auth: authWith(['password']), deleteTimeoutMs: 20 });
    const first = deferred();
    const order: string[] = [];
    let eraseRuns = 0;
    const flow = createDeleteAccountFlow({
      deleteAccount: kit.deleteAccount,
      erase: async () => {
        eraseRuns += 1;
        if (eraseRuns === 1) await first.promise; // the slow first erase, still running after the time-out
        order.push(`erase-${eraseRuns}`);
      },
      restore: async (_c, { erasing, timedOut }) => {
        order.push(`restore(timedOut=${timedOut})`);
        await erasing;
        order.push('restored');
      },
      restoreWaitMs: 30,
    });
    fns.deleteUser.mockImplementation(async () => void order.push('login'));
    const firstTry = flow('pw');
    await expect(firstTry).rejects.toMatchObject({ code: 'auth/delete-timeout' });
    // still waiting for the slow erase to end: the restore is not done
    expect(order).toEqual(['restore(timedOut=true)']);
    const retry = flow('pw');
    await tick();
    first.resolve();
    await retry;
    expect(order).toEqual(['restore(timedOut=true)', 'erase-1', 'restored', 'erase-2', 'login']);
    expect(fns.deleteUser).toHaveBeenCalledTimes(1);
  });
  it('a wrong password erases nothing and puts nothing back', async () => {
    fns.reauthenticateWithCredential.mockRejectedValue(fail('auth/invalid-credential'));
    const kit = createAuthKit({ auth: authWith(['password']) });
    const erase = vi.fn();
    const restore = vi.fn();
    const flow = createDeleteAccountFlow({ deleteAccount: kit.deleteAccount, erase, restore });
    await expect(flow('bad')).rejects.toMatchObject({ code: 'auth/wrong-current-password' });
    expect(erase).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });
});
