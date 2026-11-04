import { Pressable, View, type Text as RNText } from 'react-native';
import type { ComponentProps, ComponentType } from 'react';
import type { AuthKit } from './createAuthKit';
import type { AuthStyles } from './signInStyles';
import type { AuthComponents, AuthStrings } from './theme';
import type { AuthForm } from './useAuthForm';

interface Props {
  form: AuthForm;
  kit: AuthKit;
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
          <Text style={styles.googleMark}>G</Text>
          <Text style={styles.secondaryText}>{signingUp ? t.googleSignUp : t.google}</Text>
        </Pressable>
      )}
    </>
  );
}
