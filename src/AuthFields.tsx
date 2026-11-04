import { useState, type ComponentProps, type ComponentType } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import type { AuthKit } from './createAuthKit';
import type { AuthStyles } from './signInStyles';
import type { AuthStrings, AuthTheme } from './theme';
import type { AuthForm } from './useAuthForm';

interface Props {
  form: AuthForm;
  kit: AuthKit;
  t: AuthStrings;
  theme: AuthTheme;
  styles: AuthStyles;
  TextInput: ComponentType<ComponentProps<typeof RNTextInput>>;
  askNickname: boolean;
}

/** Email, password and (when signing up) nickname inputs. */
export function AuthFields({ form, kit, t, theme, styles, TextInput, askNickname }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
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
      />
      <TextInput
        {...common('password')}
        value={form.password}
        onChangeText={form.setPassword}
        placeholder={signingUp ? t.passwordNew(kit.minPassword) : t.password}
        secureTextEntry
        textContentType={signingUp ? 'newPassword' : 'password'}
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        onSubmitEditing={() => form.ready && !form.busy && form.submit()}
        accessibilityLabel={t.password}
      />
      {signingUp && askNickname && (
        <TextInput
          {...common('nickname')}
          value={form.nick}
          onChangeText={form.setNick}
          placeholder={t.nickname}
          maxLength={kit.maxNickname}
          autoCapitalize="words"
          textContentType="nickname"
          autoComplete="nickname"
          accessibilityLabel={t.nickname}
        />
      )}
    </>
  );
}
