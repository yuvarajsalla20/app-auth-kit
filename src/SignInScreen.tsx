import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text as RNText, TextInput as RNTextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScreenKit } from './screenKit';
import { AuthFields } from './AuthFields';
import { AuthLinks } from './AuthLinks';
import { Reveal } from './Reveal';
import { makeStyles } from './signInStyles';
import { SocialButtons } from './SocialButtons';
import { DEFAULT_STRINGS, DEFAULT_THEME, type AuthBrand, type AuthComponents, type AuthStrings, type AuthTheme } from './theme';
import { useAuthForm } from './useAuthForm';
import { useStable } from './useStable';

export interface SignInScreenProps {
  kit: ScreenKit;
  brand: AuthBrand;
  theme?: Partial<AuthTheme>;
  strings?: Partial<AuthStrings>;
  components?: Partial<AuthComponents>;
  /** Ask for an optional nickname when creating an account. */
  nickname?: boolean;
  /** Show "Forgot password?" on the sign-in form. */
  forgotPassword?: boolean;
  /** Called when "Privacy policy" is tapped. Leave out to hide the link. */
  onOpenPrivacy?: () => void;
}

/** Sign in or create an account. Looks come from `theme`, `brand` and `components`; behavior comes from `kit`. */
export function SignInScreen({
  kit,
  brand,
  theme: themeProp,
  strings: stringsProp,
  components,
  nickname: askNickname = false,
  forgotPassword = true,
  onOpenPrivacy,
}: SignInScreenProps) {
  // Inline `theme={{ ... }}` objects are fine: they are compared by value, so the styles are rebuilt only when a color changes.
  const themeOverride = useStable(themeProp);
  const stringsOverride = useStable(stringsProp);
  const theme = useMemo<AuthTheme>(() => ({ ...DEFAULT_THEME, ...themeOverride }), [themeOverride]);
  const t = useMemo<AuthStrings>(() => ({ ...DEFAULT_STRINGS, ...stringsOverride }), [stringsOverride]);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const Text = components?.Text ?? RNText;
  const TextInput = components?.TextInput ?? RNTextInput;

  const { top } = useSafeAreaInsets();
  const form = useAuthForm(kit, t, askNickname);
  const { note, busy, signingUp } = form;
  const off = !form.ready || busy;

  return (
    <View style={styles.screen}>
      {brand.backdrop}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: top + 40 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {brand.logo && (
          <Reveal rise={90} duration={1400} style={styles.logo}>
            {brand.logo}
          </Reveal>
        )}
        <Reveal delay={150}>
          <Text style={styles.brand} accessibilityRole="header">{brand.name}</Text>
          {brand.tagline ? <Text style={styles.tagline}>{brand.tagline}</Text> : null}
        </Reveal>

        <Reveal delay={250} style={styles.form}>
          <AuthFields form={form} kit={kit} t={t} theme={theme} styles={styles} TextInput={TextInput} askNickname={askNickname} />
          {note && <Text style={[styles.note, note.good && styles.good]} accessibilityLiveRegion="polite">{note.text}</Text>}
          <Pressable onPress={form.submit} disabled={off} accessibilityRole="button" accessibilityLabel={signingUp ? t.createAccount : t.signIn} accessibilityState={{ disabled: off, busy }} style={[styles.primary, off && styles.disabled]}>
            {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.primaryText}>{signingUp ? t.createAccount : t.signIn}</Text>}
          </Pressable>
          <SocialButtons form={form} kit={kit} t={t} styles={styles} Text={Text} AppleButton={components?.AppleButton} />
        </Reveal>

        <Reveal delay={350} style={styles.links}>
          <AuthLinks form={form} t={t} styles={styles} Text={Text} forgotPassword={forgotPassword} onOpenPrivacy={onOpenPrivacy} />
        </Reveal>
      </ScrollView>
    </View>
  );
}
