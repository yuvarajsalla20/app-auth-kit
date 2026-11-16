import { useRef, useState, type ComponentProps, type ReactElement, type ComponentType, type ElementRef, type RefObject } from 'react';
import { Pressable, TextInput as RNTextInput, View, type Text as RNText } from 'react-native';
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
  /** A show/hide button in each password box. */
  showPassword?: boolean;
  PasswordEye?: ComponentType<{ visible: boolean }>;
}

/** Email, password and (when signing up) confirm-password and nickname inputs. */
export function AuthFields({ form, kit, t, theme, styles, TextInput, Text, askNickname, labels, showPassword = false, PasswordEye }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
  // One switch for both password boxes, so the two can be compared by eye.
  const [visible, setVisible] = useState(false);
  // Next on the keyboard moves from email to password to nickname; the last box signs in.
  const passwordBox = useRef<ElementRef<typeof RNTextInput>>(null);
  const nickBox = useRef<ElementRef<typeof RNTextInput>>(null);
  const confirmBox = useRef<ElementRef<typeof RNTextInput>>(null);
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
  const { signingUp, confirming } = form;
  // Next on the keyboard after the password: the confirm box, then the nickname, else the button.
  const afterPassword = chain && confirming ? confirmBox : chain && signingUp && askNickname ? nickBox : null;
  const afterConfirm = chain && askNickname ? nickBox : null;
  const go = () => form.ready && !form.busy && form.submit();
  /** A password box, with the show/hide button laid over its right end when asked for. */
  const secret = (input: ReactElement) =>
    showPassword ? (
      <View style={styles.secret}>
        {input}
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? t.hidePassword : t.showPassword}
          hitSlop={8}
          style={styles.eye}
        >
          {PasswordEye ? <PasswordEye visible={visible} /> : <Text style={styles.eyeText}>{visible ? t.hide : t.show}</Text>}
        </Pressable>
      </View>
    ) : (
      input
    );
  const secretStyle = (name: string) => [common(name).style, showPassword && styles.withEye];
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
      {framed('password', t.password, secret(<TextInput
        {...ref(passwordBox)}
        {...common('password')}
        style={secretStyle('password')}
        value={form.password}
        onChangeText={form.setPassword}
        placeholder={labels ? t.passwordHint(kit.minPassword) : signingUp ? t.passwordNew(kit.minPassword) : t.password}
        secureTextEntry={!visible}
        autoCapitalize="none"
        textContentType={signingUp ? 'newPassword' : 'password'}
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        returnKeyType={afterPassword ? 'next' : 'go'}
        onSubmitEditing={() => (afterPassword ? afterPassword.current?.focus() : go())}
        accessibilityLabel={t.password}
      />))}
      {confirming && framed('confirm', t.confirmPassword, secret(<TextInput
          {...ref(confirmBox)}
          {...common('confirm')}
          style={secretStyle('confirm')}
          value={form.confirm}
          onChangeText={form.setConfirm}
          placeholder={t.confirmPassword}
          secureTextEntry={!visible}
          autoCapitalize="none"
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType={afterConfirm ? 'next' : 'go'}
          onSubmitEditing={() => (afterConfirm ? afterConfirm.current?.focus() : go())}
          accessibilityLabel={t.confirmPassword}
        />))}
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
          onSubmitEditing={go}
        />)}
    </>
  );
}
