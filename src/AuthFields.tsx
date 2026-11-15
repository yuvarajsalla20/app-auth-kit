import { useRef, useState, type ComponentProps, type ReactElement, type ComponentType, type ElementRef, type RefObject } from 'react';
import { TextInput as RNTextInput, View, type Text as RNText } from 'react-native';
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
  Text: ComponentType<ComponentProps<typeof RNText>>;
  askNickname: boolean;
  /** A small label above the text in each box, with a hint inside. */
  labels: boolean;
}

/** Email, password and (when signing up) nickname inputs. */
export function AuthFields({ form, kit, t, theme, styles, TextInput, Text, askNickname, labels }: Props) {
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
    style: labels ? styles.boxInput : [styles.input, focus === name && styles.focused],
    onFocus: () => setFocus(name),
    onBlur: () => setFocus((current) => (current === name ? null : current)),
  });
  const { signingUp } = form;
  // With labels, each box is a frame around a small label and the text; a tap anywhere in it lands in the text.
  const framed = (name: string, label: string, input: ReactElement) =>
    labels ? (
      <View style={[styles.box, focus === name && styles.focused]}>
        <Text style={styles.boxLabel} accessible={false} importantForAccessibility="no">{label}</Text>
        {input}
      </View>
    ) : (
      input
    );
  return (
    <>
      {framed('email', t.email, <TextInput
        {...common('email')}
        value={form.email}
        onChangeText={form.setEmail}
        placeholder={labels ? t.emailHint : t.email}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        accessibilityLabel={t.email}
        returnKeyType={chain ? 'next' : undefined}
        onSubmitEditing={() => passwordBox.current?.focus()}
      />)}
      {framed('password', t.password, <TextInput
        {...ref(passwordBox)}
        {...common('password')}
        value={form.password}
        onChangeText={form.setPassword}
        placeholder={labels ? t.passwordHint(kit.minPassword) : signingUp ? t.passwordNew(kit.minPassword) : t.password}
        secureTextEntry
        textContentType={signingUp ? 'newPassword' : 'password'}
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        returnKeyType={chain && signingUp && askNickname ? 'next' : 'go'}
        onSubmitEditing={() => (chain && signingUp && askNickname ? nickBox.current?.focus() : form.ready && !form.busy && form.submit())}
        accessibilityLabel={t.password}
      />)}
      {signingUp && askNickname && framed('nickname', t.nickname, <TextInput
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
        />)}
    </>
  );
}
