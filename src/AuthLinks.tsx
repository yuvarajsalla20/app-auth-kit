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
  onOpenFeatures?: () => void;
}

/**
 * Switch between sign in and create account, plus "Forgot password?" and "Privacy policy" on one line.
 * With `onOpenFeatures`: "Forgot password?" on its own line, then "Features | Privacy policy" under it.
 */
export function AuthLinks({ form, t, styles, Text, forgotPassword, onOpenPrivacy, onOpenFeatures }: Props) {
  const showForgot = forgotPassword && !form.signingUp;
  const forgot = showForgot ? (
    <Pressable onPress={form.forgot} disabled={form.busy} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.muted}>{t.forgot}</Text>
    </Pressable>
  ) : null;
  const link = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}>
      <Text style={styles.muted}>{label}</Text>
    </Pressable>
  );
  const pages = [onOpenFeatures ? link(t.features, onOpenFeatures) : null, onOpenPrivacy ? link(t.privacy, onOpenPrivacy) : null].filter(Boolean);
  return (
    <>
      <Pressable onPress={form.switchMode} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.link}>{form.signingUp ? t.haveAccount : t.newHere}</Text>
      </Pressable>
      {onOpenFeatures ? (
        <>
          {forgot ? <View style={styles.legal}>{forgot}</View> : null}
          <View style={styles.legal}>
            {pages[0]}
            {pages.length > 1 && <Text style={styles.pipe}>|</Text>}
            {pages[1]}
          </View>
        </>
      ) : (
        (showForgot || onOpenPrivacy) && (
          <View style={styles.legal}>
            {forgot}
            {showForgot && onOpenPrivacy && <Text style={styles.pipe}>|</Text>}
            {onOpenPrivacy && link(t.privacy, onOpenPrivacy)}
          </View>
        )
      )}
    </>
  );
}
