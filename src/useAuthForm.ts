import { useRef, useState } from 'react';
import type { ScreenKit } from './screenKit';
import type { AuthStrings } from './theme';

type Mode = 'signin' | 'signup';

/** The sign-in form's state and actions. Only one action runs at a time, even if the button is tapped twice in one frame. */
export function useAuthForm(kit: ScreenKit, t: AuthStrings, askNickname: boolean, askConfirm = false) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const running = useRef(false);

  const signingUp = mode === 'signup';
  /** Creating an account with `confirmPassword`: the second box must match before the button turns on. */
  const confirming = signingUp && askConfirm;
  const matches = !confirming || confirm === password;
  /** Say so only once something is typed in the second box, not while it is still empty. */
  const mismatch = confirming && confirm.length > 0 && !matches;
  const ready = email.includes('@') && password.length >= (signingUp ? kit.minPassword : 1) && matches;

  /** Runs one action, showing a spinner and a plain-language error if it fails. */
  const run = async (action: () => Promise<unknown>, success?: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNote(null);
    try {
      await action();
      if (success) setNote({ text: success, good: true });
    } catch (e) {
      const text = kit.message(e);
      if (text) setNote({ text });
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return {
    email, setEmail, password, setPassword, nick, setNick, confirm, setConfirm, confirming, mismatch,
    busy, note, signingUp, ready,
    submit: () => run(() => (signingUp ? kit.signUpEmail(email, password, askNickname ? nick : '') : kit.signInEmail(email, password))),
    forgot: () => (email.includes('@') ? run(() => kit.sendPasswordReset(email), t.resetSent) : setNote({ text: t.forgotNeedsEmail })),
    signInApple: () => run(kit.signInApple),
    signInGoogle: () => run(kit.signInGoogle),
    switchMode: () => {
      setMode(signingUp ? 'signin' : 'signup');
      setNote(null);
    },
  };
}
export type AuthForm = ReturnType<typeof useAuthForm>;
