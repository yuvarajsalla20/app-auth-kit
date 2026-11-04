import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeAuth } from '../src/useAuth';
import { fns, resetSpies } from './helpers';

beforeEach(resetSpies);
const auth = {} as never;

describe('subscribeAuth', () => {
  it('is signed out, not stuck loading, when Firebase is not configured', () => {
    const set = vi.fn();
    expect(subscribeAuth(null, true, set)).toBeUndefined();
    expect(set).toHaveBeenCalledWith({ status: 'out' });
  });
  it('is signed out when turned off', () => {
    const set = vi.fn();
    subscribeAuth(auth, false, set);
    expect(set).toHaveBeenCalledWith({ status: 'out' });
    expect(fns.onAuthStateChanged).not.toHaveBeenCalled();
  });
  it('follows the person in and out and returns the unsubscribe', () => {
    const stop = vi.fn();
    fns.onAuthStateChanged.mockImplementation((_a, next) => { next({ uid: 'u1' }); next(null); return stop; });
    const set = vi.fn();
    expect(subscribeAuth(auth, true, set)).toBe(stop);
    expect(set).toHaveBeenNthCalledWith(1, { status: 'in', user: { uid: 'u1' } });
    expect(set).toHaveBeenNthCalledWith(2, { status: 'out' });
  });
  it('treats a listener error as signed out and reports it', () => {
    fns.onAuthStateChanged.mockImplementation((_a, _n, onErr) => { onErr(new Error('boom')); return vi.fn(); });
    const set = vi.fn();
    const onError = vi.fn();
    subscribeAuth(auth, true, set, onError);
    expect(set).toHaveBeenCalledWith({ status: 'out' });
    expect(onError).toHaveBeenCalledWith('auth-state', expect.any(Error));
  });
});
