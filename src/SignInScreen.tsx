import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput as RNTextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthKit } from './createAuthKit';
import { Reveal } from './Reveal';
import { DEFAULT_STRINGS, DEFAULT_THEME, type AuthBrand, type AuthComponents, type AuthStrings, type AuthTheme } from './theme';

export interface SignInScreenProps {
  kit: AuthKit;
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

type Mode = 'signin' | 'signup';

/** Sign in or create an account. Looks come from `theme`, `brand` and `components`; behavior comes from `kit`. */
export function SignInScreen({
  kit,
  brand,
  theme: themeOverride,
  strings: stringsOverride,
  components,
  nickname: askNickname = false,
  forgotPassword = true,
  onOpenPrivacy,
}: SignInScreenProps) {
  const theme = useMemo<AuthTheme>(() => ({ ...DEFAULT_THEME, ...themeOverride }), [themeOverride]);
  const t = useMemo<AuthStrings>(() => ({ ...DEFAULT_STRINGS, ...stringsOverride }), [stringsOverride]);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const Text = components?.Text ?? RNText;
  const TextInput = components?.TextInput ?? RNTextInput;

  const { top } = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const signingUp = mode === 'signup';
  const ready = email.includes('@') && password.length >= (signingUp ? kit.minPassword : 1);

  /** Runs one action, showing a spinner and a plain-language error if it fails. */
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await action();
      if (success) setNote({ text: success, good: true });
    } catch (e) {
      const text = kit.message(e);
      if (text) setNote({ text });
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(() => (signingUp ? kit.signUpEmail(email, password, askNickname ? nick : '') : kit.signInEmail(email, password)));

  const forgot = () =>
    email.includes('@') ? run(() => kit.sendPasswordReset(email), t.resetSent) : setNote({ text: t.forgotNeedsEmail });

  const field = (name: string) => [styles.input, focus === name && styles.focused];
  const common = (name: string) => ({
    placeholderTextColor: theme.muted,
    autoCorrect: false,
    style: field(name),
    onFocus: () => setFocus(name),
    onBlur: () => setFocus((current) => (current === name ? null : current)),
  });

  return (
    <View style={styles.screen}>
      {brand.backdrop}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: top + 40 }]} keyboardShouldPersistTaps="handled">
        {brand.logo && (
          <Reveal rise={90} duration={1400} style={styles.logo}>
            {brand.logo}
          </Reveal>
        )}
        <Reveal delay={500}>
          <Text style={styles.brand} accessibilityRole="header">{brand.name}</Text>
          {brand.tagline ? <Text style={styles.tagline}>{brand.tagline}</Text> : null}
        </Reveal>

        <Reveal delay={800} style={styles.form}>
          <TextInput
            {...common('email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t.email}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            accessibilityLabel={t.email}
          />
          <TextInput
            {...common('password')}
            value={password}
            onChangeText={setPassword}
            placeholder={signingUp ? t.passwordNew(kit.minPassword) : t.password}
            secureTextEntry
            textContentType={signingUp ? 'newPassword' : 'password'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            onSubmitEditing={() => ready && !busy && submit()}
            accessibilityLabel={t.password}
          />
          {signingUp && askNickname && (
            <TextInput
              {...common('nickname')}
              value={nick}
              onChangeText={setNick}
              placeholder={t.nickname}
              maxLength={kit.maxNickname}
              autoCapitalize="words"
              textContentType="nickname"
              autoComplete="nickname"
              accessibilityLabel={t.nickname}
            />
          )}

          {note && <Text style={[styles.note, note.good && styles.good]} accessibilityLiveRegion="polite">{note.text}</Text>}

          <Pressable onPress={submit} disabled={!ready || busy} accessibilityRole="button" style={[styles.primary, (!ready || busy) && styles.disabled]}>
            {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.primaryText}>{signingUp ? t.createAccount : t.signIn}</Text>}
          </Pressable>

          {kit.google && (
            <Pressable onPress={() => run(kit.signInGoogle)} disabled={busy} accessibilityRole="button" style={styles.secondary}>
              <Text style={styles.secondaryText}>{t.google}</Text>
            </Pressable>
          )}
        </Reveal>

        <Reveal delay={1000} style={styles.links}>
          <Pressable onPress={() => { setMode(signingUp ? 'signin' : 'signup'); setNote(null); }} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>{signingUp ? t.haveAccount : t.newHere}</Text>
          </Pressable>
          {forgotPassword && !signingUp && (
            <Pressable onPress={forgot} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.muted}>{t.forgot}</Text>
            </Pressable>
          )}
          {onOpenPrivacy && (
            <Pressable onPress={onOpenPrivacy} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.muted}>{t.privacy}</Text>
            </Pressable>
          )}
        </Reveal>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: AuthTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 24, paddingBottom: 32, maxWidth: 480, width: '100%', alignSelf: 'center' },
    logo: { alignItems: 'center' },
    brand: { color: c.text, fontSize: 44, fontWeight: '200', letterSpacing: -1, textAlign: 'center' },
    tagline: { marginTop: 8, color: c.muted, fontSize: 15, textAlign: 'center' },
    form: { marginTop: 36, gap: 12 },
    input: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 14, color: c.text, fontSize: 16, paddingHorizontal: 16, height: 48 },
    focused: { borderColor: c.accent },
    note: { color: c.danger, fontSize: 13, lineHeight: 18 },
    good: { color: c.accent },
    primary: { backgroundColor: c.text, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
    primaryText: { color: c.bg, fontSize: 16, fontWeight: '500' },
    secondary: { borderColor: c.border, borderWidth: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    secondaryText: { color: c.text, fontSize: 16 },
    disabled: { opacity: 0.4 },
    links: { marginTop: 28, gap: 16, alignItems: 'center' },
    link: { color: c.accent, fontSize: 14 },
    muted: { color: c.muted, fontSize: 13 },
  });
