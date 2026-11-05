import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInScreen } from '../src/SignInScreen';
import { DEFAULT_STRINGS as S } from '../src/theme';
import { motion } from './stubs/react-native';
import { act, fakeKit, focused, mount, press, submit, type } from './render';

const screen = (kit = fakeKit(), props: Record<string, unknown> = {}) => mount(<SignInScreen kit={kit} brand={{ name: 'App' }} {...props} />);

beforeEach(() => {
  motion.started = 0;
  motion.stopped = 0;
  motion.setTo.length = 0;
  motion.reduce = false;
  focused.length = 0;
});

describe('SignInScreen form', () => {
  it('keeps the button off until the email has @ and a password is typed; sign-up wants the minimum', async () => {
    const h = screen();
    expect(h.text(S.signIn)!.props.disabled).toBe(true);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'x');
    expect(h.text(S.signIn)!.props.disabled).toBe(false);
    await press(h.text(S.newHere)!);
    expect(h.text(S.createAccount)!.props.disabled).toBe(true);
    await type(h.label(S.password), 'long-enough');
    expect(h.text(S.createAccount)!.props.disabled).toBe(false);
  });

  it('shows the kit\'s plain-words error, and nothing for a cancel', async () => {
    const kit = fakeKit({ signInEmail: vi.fn(() => Promise.reject(new Error('Email or password is not correct.'))) });
    const h = screen(kit);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'pw');
    await press(h.text(S.signIn)!);
    expect(h.shown('Email or password is not correct.')).toBe(true);
    kit.message = () => '';
    await press(h.text(S.signIn)!);
    expect(h.shown('Email or password is not correct.')).toBe(false);
  });

  it('asks for the email before sending a reset, and says a reset is on its way only if the address has an account', async () => {
    const kit = fakeKit();
    const h = screen(kit);
    await press(h.text(S.forgot)!);
    expect(h.shown(S.forgotNeedsEmail)).toBe(true);
    await type(h.label(S.email), 'a@b.com');
    await press(h.text(S.forgot)!);
    expect(kit.sendPasswordReset).toHaveBeenCalledWith('a@b.com');
    expect(h.shown(S.resetSent)).toBe(true);
    expect(S.resetSent).toMatch(/^If that address has an account/);
  });

  it('runs one action when the button is tapped twice in the same instant', async () => {
    const kit = fakeKit({ signInEmail: vi.fn(() => new Promise(() => {})) });
    const h = screen(kit);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'pw');
    const tap = h.text(S.signIn)!.props.onPress;
    await act(async () => {
      tap();
      tap();
    });
    expect(kit.signInEmail).toHaveBeenCalledTimes(1);
  });
});

describe('SignInScreen accessibility and keyboard', () => {
  it('names the main button and says when it is busy, even while it shows only a spinner', async () => {
    const h = screen(fakeKit({ signInEmail: vi.fn(() => new Promise(() => {})) }));
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'pw');
    await press(h.text(S.signIn)!);
    const button = h.root.root.findAll((n) => n.type === 'Pressable' && n.findAll((c) => c.type === 'ActivityIndicator').length > 0)[0]!;
    expect(button.props.accessibilityLabel).toBe(S.signIn);
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('moves from email to password with the Next key, and signs in from the password box', async () => {
    const kit = fakeKit();
    const h = screen(kit);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'pw');
    expect(h.label(S.email).props.returnKeyType).toBe('next');
    await submit(h.label(S.email));
    expect(focused).toEqual([S.password]);
    await submit(h.label(S.password));
    expect(kit.signInEmail).toHaveBeenCalledTimes(1);
  });

  it('goes on to the nickname when signing up with one, and signs up from there', async () => {
    const kit = fakeKit();
    const h = screen(kit, { nickname: true });
    await press(h.text(S.newHere)!);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'long-enough');
    await submit(h.label(S.password));
    expect(focused).toEqual([S.nickname]);
    expect(kit.signUpEmail).not.toHaveBeenCalled();
    await submit(h.label(S.nickname));
    expect(kit.signUpEmail).toHaveBeenCalledTimes(1);
  });

  it('leaves an app\'s own plain text input alone (no ref warning, and the password box still signs in)', async () => {
    const Plain = (props: Record<string, unknown>) => <input {...props} />;
    const kit = fakeKit();
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = screen(kit, { components: { TextInput: Plain } });
    expect(h.root.root.findAll((n) => n.type === Plain).length).toBeGreaterThan(0);
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/cannot be given refs/);
    warn.mockRestore();
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'pw');
    await submit(h.label(S.password));
    expect(kit.signInEmail).toHaveBeenCalledTimes(1);
  });

  it('lets the keyboard push the form up', () => {
    expect(screen().first('ScrollView').props.automaticallyAdjustKeyboardInsets).toBe(true);
  });
});

describe('SignInScreen motion', () => {
  it('stops the entrance animation when the screen goes away', () => {
    const h = screen(fakeKit(), { brand: { name: 'App', logo: <></> } });
    expect(motion.started).toBeGreaterThan(0);
    const stoppedBefore = motion.stopped;
    h.unmount();
    expect(motion.stopped - stoppedBefore).toBe(motion.started);
  });

  it('shows everything at once when the phone asks for reduced motion', async () => {
    motion.reduce = true;
    screen();
    await act(async () => {});
    expect(motion.setTo.length).toBeGreaterThan(0);
    expect(motion.setTo.every((v) => v === 1)).toBe(true);
  });

  it('does not set anything when motion is allowed', async () => {
    screen();
    await act(async () => {});
    expect(motion.setTo).toEqual([]);
  });
});

describe('SignInScreen theme', () => {
  it('rebuilds nothing when the parent hands in the same colors in a new object', () => {
    const make = (accent: string) => <SignInScreen kit={fakeKit()} brand={{ name: 'App' }} theme={{ bg: '#000', accent }} />;
    const h = mount(make('#fff'));
    const styleBefore = h.first('ScrollView').parent!.props.style;
    h.rerender(make('#fff'));
    expect(h.first('ScrollView').parent!.props.style).toBe(styleBefore);
    h.rerender(make('#f00'));
    expect(h.first('ScrollView').parent!.props.style).not.toBe(styleBefore);
  });
});
