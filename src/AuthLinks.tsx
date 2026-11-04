import { Pressable, View, type Text as RNText } from 'react-native';
import type { ComponentProps, ComponentType } from 'react';
import type { AuthStyles } from './signInStyles';
import type { AuthStrings } from './theme';
import type { AuthForm } from './useAuthForm';

interface Props {
  form: AuthForm;
  t: AuthStrings;
  styles: AuthStyles;
  Text: ComponentType<ComponentProps<typeof RNText>>;
  forgotPassword: boolean;
  onOpenPrivacy?: () => void;
}

/** Switch between sign in and create account, plus "Forgot password?" and "Privacy policy". */
export function AuthLinks({ form, t, styles, Text, forgotPassword, onOpenPrivacy }: Props) {
  const showForgot = forgotPassword && !form.signingUp;
  return (
    <>
      <Pressable onPress={form.switchMode} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.link}>{form.signingUp ? t.haveAccount : t.newHere}</Text>
      </Pressable>
      {(showForgot || onOpenPrivacy) && (
        <View style={styles.legal}>
          {showForgot && (
            <Pressable onPress={form.forgot} disabled={form.busy} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.muted}>{t.forgot}</Text>
            </Pressable>
          )}
          {showForgot && onOpenPrivacy && <Text style={styles.pipe}>|</Text>}
          {onOpenPrivacy && (
            <Pressable onPress={onOpenPrivacy} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.muted}>{t.privacy}</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );
}
