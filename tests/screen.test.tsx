import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_MARK } from '../src/sign-in/googleMark';
import { SignInScreen } from '../src/sign-in/SignInScreen';
import { DEFAULT_STRINGS as S } from '../src/sign-in/theme';
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
  it('Features link (1.16.0): only when passed; Forgot password gets its own line, Features | Privacy under it', async () => {
    expect(screen(fakeKit(), { onOpenPrivacy: vi.fn() }).shown(S.features)).toBe(false);
    const onOpenFeatures = vi.fn();
    const onOpenPrivacy = vi.fn();
    const h = screen(fakeKit(), { onOpenFeatures, onOpenPrivacy });
    await press(h.text(S.features)!);
    expect(onOpenFeatures).toHaveBeenCalledOnce();
    await press(h.text(S.privacy)!);
    expect(onOpenPrivacy).toHaveBeenCalledOnce();
    // Forgot password is not on the same line as the two links.
    const rowOf = (label: string) => h.root.root.findAll((n) => n.props.style && n.findAll((c) => c.props.children === label).length > 0 && n.type === 'View').at(-1);
    expect(rowOf(S.forgot)).not.toBe(rowOf(S.features));
    expect(rowOf(S.privacy)).toBe(rowOf(S.features));
  });

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

describe('the Google button', () => {
  it('puts the four-colour Google logo in front of the words, hidden from the screen reader, and still signs in', async () => {
    const kit = fakeKit({ google: true });
    const h = screen(kit);
    const button = h.text(S.google)!;
    const logo = button.findAll((n) => n.type === 'Image')[0]!;
    expect(logo.props.source.uri).toBe(GOOGLE_MARK);
    expect(GOOGLE_MARK).toMatch(/^data:image\/png;base64,iVBOR/);
    expect(logo.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(logo.props.accessible).toBe(false);
    expect(button.findAll((n) => n.type === 'Text').map((n) => n.props.children)).not.toContain('G');
    expect(button.findAll((n) => n.type === 'Image' || n.type === 'Text').map((n) => n.type)).toEqual(['Image', 'Text']); // logo first, then the words
    await press(button);
    expect(kit.signInGoogle).toHaveBeenCalledTimes(1);
  });
  it('shows no logo when Google is off', () => {
    expect(screen(fakeKit({ google: false })).root.root.findAll((n) => n.type === 'Image')).toHaveLength(0);
  });
});

describe('SignInScreen labels and button art (v1.14)', () => {
  it('puts a small label above each box and a hint inside, and still signs in', async () => {
    const kit = fakeKit();
    const h = screen(kit, { labels: true });
    expect(h.shown(S.email)).toBe(true);
    expect(h.label(S.email).props.placeholder).toBe(S.emailHint);
    expect(h.label(S.password).props.placeholder).toBe(S.passwordHint(8));
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'pw');
    await press(h.text(S.signIn)!);
    expect(kit.signInEmail).toHaveBeenCalled();
  });

  it('keeps the plain boxes by default', () => {
    const h = screen();
    expect(h.label(S.email).props.placeholder).toBe(S.email);
  });

  it('draws brand.button inside the main button, behind its words', () => {
    const Art = () => null;
    const h = mount(<SignInScreen kit={fakeKit()} brand={{ name: 'App', button: <Art /> }} />);
    const button = h.text(S.signIn)!;
    expect(button.findAllByType(Art).length).toBe(1);
  });
});

describe('SignInScreen confirm password and show/hide', () => {
  it('asks for the password twice when creating an account, and keeps the button off until both match', async () => {
    const kit = fakeKit();
    const h = screen(kit, { confirmPassword: true });
    expect(h.label(S.confirmPassword)).toBeUndefined();
    await press(h.text(S.newHere)!);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'long-enough');
    expect(h.text(S.createAccount)!.props.disabled).toBe(true);
    expect(h.shown(S.passwordsDiffer)).toBe(false);
    await type(h.label(S.confirmPassword), 'long-enougH');
    expect(h.shown(S.passwordsDiffer)).toBe(true);
    expect(h.text(S.createAccount)!.props.disabled).toBe(true);
    await type(h.label(S.confirmPassword), 'long-enough');
    expect(h.shown(S.passwordsDiffer)).toBe(false);
    await press(h.text(S.createAccount)!);
    expect(kit.signUpEmail).toHaveBeenCalledWith('a@b.com', 'long-enough', '');
  });

  it('never asks twice when signing in, or when the app leaves it off', async () => {
    const h = screen(fakeKit(), { confirmPassword: true });
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'x');
    expect(h.text(S.signIn)!.props.disabled).toBe(false);
    const off = screen();
    await press(off.text(S.newHere)!);
    expect(off.label(S.confirmPassword)).toBeUndefined();
  });

  it('shows and hides both passwords with one button, and draws the app\'s eye when given', async () => {
    const h = screen(fakeKit(), { confirmPassword: true, showPassword: true });
    await press(h.text(S.newHere)!);
    expect(h.label(S.password).props.secureTextEntry).toBe(true);
    await press(h.label(S.showPassword));
    expect(h.label(S.password).props.secureTextEntry).toBe(false);
    expect(h.label(S.confirmPassword).props.secureTextEntry).toBe(false);
    expect(h.shown(S.hide)).toBe(true);
    await press(h.label(S.hidePassword));
    expect(h.label(S.password).props.secureTextEntry).toBe(true);
    const Eye = ({ visible }: { visible: boolean }) => <>{visible ? 'open-eye' : 'shut-eye'}</>;
    const e = screen(fakeKit(), { showPassword: true, components: { PasswordEye: Eye } });
    expect(e.root.root.findAll((n) => n.type === Eye)[0]!.props.visible).toBe(false);
    expect(e.shown(S.show)).toBe(false);
  });

  it('forgets the confirm box and hides the passwords again when switching between sign-in and sign-up', async () => {
    const h = screen(fakeKit(), { confirmPassword: true, showPassword: true });
    await press(h.text(S.newHere)!);
    await type(h.label(S.email), 'a@b.com');
    await type(h.label(S.password), 'abcdefgh');
    await type(h.label(S.confirmPassword), 'abcdefgh');
    await press(h.label(S.showPassword));
    await press(h.text(S.haveAccount)!);
    expect(h.label(S.password).props.secureTextEntry).toBe(true);
    await type(h.label(S.password), 'abcdefgX');
    await press(h.text(S.newHere)!);
    expect(h.label(S.confirmPassword).props.value).toBe('');
    expect(h.shown(S.passwordsDiffer)).toBe(false);
    expect(h.text(S.createAccount)!.props.disabled).toBe(true);
  });

  it('has no show/hide button unless the app asks for one', () => {
    const h = screen();
    expect(h.label(S.showPassword)).toBeUndefined();
  });
});

describe('1.19.0 Apple accounts on Android', () => {
  it('tells people who joined with Apple how to sign in on Android, only there and only when signing in', async () => {
    const { Platform } = await import('./stubs/react-native');
    const was = Platform.OS;
    expect(screen().shown(S.appleOnAndroid)).toBe(false); // iPhone
    Platform.OS = 'android';
    try {
      const h = screen();
      expect(h.shown(S.appleOnAndroid)).toBe(true);
      await press(h.text(S.newHere)!);
      expect(h.shown(S.appleOnAndroid)).toBe(false);
    } finally {
      Platform.OS = was;
    }
  });
});
