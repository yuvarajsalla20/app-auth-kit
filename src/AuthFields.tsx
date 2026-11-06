import { useRef, useState, type ComponentProps, type ComponentType, type ElementRef, type RefObject } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import type { ScreenKit } from './screenKit';
import type { AuthStyles } from './signInStyles';
import type { AuthStrings, AuthTheme } from './theme';
import type { AuthForm } from './useAuthForm';

interface Props {
  form: AuthForm;
  kit: ScreenKit;
  t: AuthStrings;
  theme: AuthTheme;
  styles: AuthStyles;
  TextInput: ComponentType<ComponentProps<typeof RNTextInput>>;
  askNickname: boolean;
}

/** Email, password and (when signing up) nickname inputs. */
export function AuthFields({ form, kit, t, theme, styles, TextInput, askNickname }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
  // Next on the keyboard moves from email to password to nickname; the last box signs in.
  const passwordBox = useRef<ElementRef<typeof RNTextInput>>(null);
  const nickBox = useRef<ElementRef<typeof RNTextInput>>(null);
  // Only a text input that hands its ref on can be focused by us; an app's own plain component is left alone (no warning, no chain).
  const chain = TextInput === RNTextInput || (TextInput as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref');
  const ref = (box: RefObject<unknown>): object => (chain ? { ref: box } : {});
  const common = (name: string) => ({
    placeholderTextColor: theme.muted,
    autoCorrect: false,
    style: [styles.input, focus === name && styles.focused],
    onFocus: () => setFocus(name),
    onBlur: () => setFocus((current) => (current === name ? null : current)),
  });
  const { signingUp } = form;
  return (
    <>
      <TextInput
        {...common('email')}
        value={form.email}
        onChangeText={form.setEmail}
        placeholder={t.email}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        accessibilityLabel={t.email}
        returnKeyType={chain ? 'next' : undefined}
        onSubmitEditing={() => passwordBox.current?.focus()}
      />
      <TextInput
        {...ref(passwordBox)}
        {...common('password')}
        value={form.password}
        onChangeText={form.setPassword}
        placeholder={signingUp ? t.passwordNew(kit.minPassword) : t.password}
        secureTextEntry
        textContentType={signingUp ? 'newPassword' : 'password'}
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        returnKeyType={chain && signingUp && askNickname ? 'next' : 'go'}
        onSubmitEditing={() => (chain && signingUp && askNickname ? nickBox.current?.focus() : form.ready && !form.busy && form.submit())}
        accessibilityLabel={t.password}
      />
      {signingUp && askNickname && (
        <TextInput
          {...ref(nickBox)}
          {...common('nickname')}
          value={form.nick}
          onChangeText={form.setNick}
          placeholder={t.nickname}
          maxLength={kit.maxNickname}
          autoCapitalize="words"
          textContentType="nickname"
          autoComplete="nickname"
          accessibilityLabel={t.nickname}
          returnKeyType="go"
          onSubmitEditing={() => form.ready && !form.busy && form.submit()}
        />
      )}
    </>
  );
}
