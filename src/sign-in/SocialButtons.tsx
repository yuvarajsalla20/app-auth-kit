import { Image, Platform, Pressable, View, type Text as RNText } from 'react-native';
import type { ComponentProps, ComponentType } from 'react';
import type { ScreenKit } from './screenKit';
import { GOOGLE_MARK } from './googleMark';
import type { AuthStyles } from './signInStyles';
import type { AuthComponents, AuthStrings } from './theme';
import type { AuthForm } from './useAuthForm';

interface Props {
  form: AuthForm;
  kit: ScreenKit;
  t: AuthStrings;
  styles: AuthStyles;
  Text: ComponentType<ComponentProps<typeof RNText>>;
  AppleButton?: AuthComponents['AppleButton'];
}

/** The "or" divider plus the Apple and Google buttons the app has switched on. */
export function SocialButtons({ form, kit, t, styles, Text, AppleButton }: Props) {
  if (!kit.apple && !kit.google) return null;
  const { signingUp, busy } = form;
  return (
    <>
      <View style={styles.or}>
        <View style={styles.rule} />
        <Text style={styles.muted}>{t.or}</Text>
        <View style={styles.rule} />
      </View>
      {kit.apple &&
        (AppleButton ? (
          <AppleButton signUp={signingUp} disabled={busy} onPress={form.signInApple} />
        ) : (
          <Pressable onPress={form.signInApple} disabled={busy} accessibilityRole="button" style={styles.apple}>
            <Text style={styles.appleText}>{`  ${signingUp ? t.appleSignUp : t.apple}`}</Text>
          </Pressable>
        ))}
      {kit.google && (
        <Pressable onPress={form.signInGoogle} disabled={busy} accessibilityRole="button" style={[styles.secondary, styles.row]}>
          <Image source={{ uri: GOOGLE_MARK }} style={styles.googleMark} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <Text style={styles.secondaryText}>{signingUp ? t.googleSignUp : t.google}</Text>
        </Pressable>
      )}
    </>
  );
}

/**
 * 1.19.0: Android has no Apple sheet, so someone who joined with Apple on iPhone is told how to log in here: add a password on
 * iPhone, then use their email. Shown on Android when logging in, never on iPhone or the web.
 */
export function AppleOnAndroidNote({ form, t, styles, Text }: Pick<Props, 'form' | 't' | 'styles' | 'Text'>) {
  if (Platform.OS !== 'android' || form.signingUp || !t.appleOnAndroid) return null;
  return <Text style={[styles.muted, { textAlign: 'center', marginTop: 12, lineHeight: 18 }]}>{t.appleOnAndroid}</Text>;
}
