// Delete Account from start to finish, around either kit's `deleteAccount`. Imports no backend, so both entries export it.
import { codeOf, coded } from './errors';

/** What the delete went through before it failed, handed to `restore`. */
export interface RestoreInfo {
  /** The kit gave up waiting for the erase (`auth/delete-timeout`). The erase may still be running. */
  timedOut: boolean;
  /** The erase had finished when the delete failed (the login could not be removed, say). */
  eraseFinished: boolean;
  /**
   * Settles (never rejects) once the erase has really ended. `restore` is called at once, so the app can stop an erase
   * that is still running; wait for this before sending anything up again, or a delete already sent can land after it.
   */
  erasing: Promise<void>;
}

/** The app's own parts of Delete Account. `C` is what the app needs to name the person (a user ID, say), passed to every step. */
export interface DeleteAccountFlowSteps<C = void> {
  /** The kit's `deleteAccount` (Firebase or Supabase): confirms the person, runs the erase it is given, removes the login. */
  deleteAccount: (password: string, eraseData: () => Promise<void>) => Promise<void>;
  /** Erases the app's own data for this person. It must be safe to run again: a failed delete can be retried. */
  erase: (context: C) => Promise<void>;
  /**
   * The delete failed after the erase had started, so the person still has an account and their data must come back.
   * Called once per failed try, never when nothing was erased (a wrong password, a cancelled sheet).
   */
  restore: (context: C, info: RestoreInfo) => Promise<void>;
  /**
   * A note kept on the phone while data may be half erased: set before the erase starts, cleared once the login is gone
   * or `restore` has finished (and the erase has ended). If the app is closed in between, the note is still there on the
   * next launch: the app then sends this phone's copy up again instead of trusting an empty backup. A failed `set`
   * stops the delete before anything is erased.
   */
  marker?: { set: (context: C) => Promise<void>; clear: (context: C) => Promise<void> };
  /** Run in order once the login is gone (this phone's copy, alerts, a PIN). A failure is reported, never shown as "could not delete". */
  cleanups?: [name: string, run: (context: C) => Promise<void>][];
  /** Gets every quiet failure, by place name. */
  report?: (where: string, error: unknown) => void;
  /**
   * How long a failed delete waits for `restore` before it shows the error (ms). Default 5000. The restore goes on
   * after that, and a new try waits for it first.
   */
  restoreWaitMs?: number;
}

const settled = (p: Promise<unknown>): Promise<void> => p.then(() => undefined, () => undefined);

/** Waits for `p`, at most `ms`. True when `p` settled in time. */
const within = (p: Promise<void>, ms: number): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.then(() => true),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};

/**
 * Delete Account, start to finish, with the same rules in every app:
 * - Nothing is erased until the kit has confirmed it is really them.
 * - Any failure once the erase has started calls `restore`, including a time-out while the erase is still running
 *   (`restore` gets a promise for its end). A failure before that changes nothing.
 * - Once the login is gone the account is deleted: `cleanups` run, and their failures are only reported.
 * - A try started while an earlier failed one is still restoring waits for it, so the two never overlap.
 * Returns `(password, context) => Promise<void>`, which rejects with the kit's error when the delete did not finish.
 */
export const createDeleteAccountFlow = <C = void>(steps: DeleteAccountFlowSteps<C>) => {
  const { marker, cleanups = [], restoreWaitMs = 5000 } = steps;
  const report = (where: string, error: unknown) => steps.report?.(where, error);
  /** The restore of an earlier failed try, while it runs. */
  let restoring: Promise<void> | null = null;

  const restoreAfter = (context: C, info: RestoreInfo): Promise<void> => {
    const run: Promise<void> = (async () => {
      try {
        await steps.restore(context, info);
        await info.erasing;
        // One more turn, so the kit has also let go of the ended erase and a new try starts a fresh one.
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch (e) {
        // The note stays: the next launch sends this phone's copy up again.
        report('delete-restore', e);
        return;
      }
      await marker?.clear(context).catch((e) => report('erase-marker', e));
    })().finally(() => {
      if (restoring === run) restoring = null;
    });
    restoring = run;
    return run;
  };

  return async (password: string, context: C): Promise<void> => {
    if (restoring && !(await within(restoring, restoreWaitMs))) throw coded('Already deleting.', 'auth/delete-in-progress');

    let stopped = false;
    let started = false;
    let finished = false;
    let erase: Promise<void> | null = null;
    const eraseData = (): Promise<void> => {
      erase = (async () => {
        await marker?.set(context);
        // The kit gave up while the note was being written: nothing has been erased, so nothing must be.
        if (stopped) throw coded('Delete stopped.', 'auth/delete-timeout');
        started = true;
        await steps.erase(context);
        finished = true;
      })();
      return erase;
    };

    try {
      await steps.deleteAccount(password, eraseData);
    } catch (e) {
      stopped = true;
      if (started && erase) {
        const info: RestoreInfo = { timedOut: codeOf(e) === 'auth/delete-timeout', eraseFinished: finished, erasing: settled(erase) };
        await within(restoreAfter(context, info), restoreWaitMs);
      }
      throw e;
    }

    for (const [name, run] of cleanups) await run(context).catch((e) => report(name, e));
    await marker?.clear(context).catch((e) => report('erase-marker', e));
  };
};

export type DeleteAccountFlow<C = void> = ReturnType<typeof createDeleteAccountFlow<C>>;
