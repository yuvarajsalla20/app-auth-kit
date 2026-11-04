import { describe, expect, it } from 'vitest';
import { createAuthKit } from '../src/createAuthKit';
import { FALLBACK_MESSAGE } from '../src/messages';

const kit = createAuthKit({ auth: null, minPassword: 10 });

describe('message()', () => {
  it('says nothing when the person cancels', () => {
    expect(kit.message({ code: 'auth/cancelled' })).toBe('');
    expect(kit.message({ code: 'auth/popup-closed-by-user' })).toBe('');
  });
  it('shows the code of an unknown error', () => {
    expect(kit.message({ code: 'auth/brand-new' })).toBe(`${FALLBACK_MESSAGE} (auth/brand-new)`);
    expect(kit.message(new Error('x'))).toBe(FALLBACK_MESSAGE);
  });
  it('does not match inherited object keys', () => {
    expect(kit.message({ code: 'constructor' })).toBe(`${FALLBACK_MESSAGE} (constructor)`);
  });
  it('uses the configured minimum password length', () => {
    expect(kit.message({ code: 'auth/weak-password' })).toContain('10');
  });
});
