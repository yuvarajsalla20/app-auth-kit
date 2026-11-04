import { useRef, useState } from 'react';
import type { AuthKit } from './createAuthKit';
import type { AuthStrings } from './theme';

type Mode = 'signin' | 'signup';

/** The sign-in form's state and actions. Only one action runs at a time, even if the button is tapped twice in one frame. */
export function useAuthForm(kit: AuthKit, t: AuthStrings, askNickname: boolean) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const running = useRef(false);

  const signingUp = mode === 'signup';
  const ready = email.includes('@') && password.length >= (signingUp ? kit.minPassword : 1);

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
    email, setEmail, password, setPassword, nick, setNick,
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
