import { StyleSheet } from 'react-native';
import type { AuthTheme } from './theme';

export const makeStyles = (c: AuthTheme) =>
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
    secondary: { borderColor: c.border, borderWidth: 1, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', gap: 10 },
    or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
    rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    apple: { backgroundColor: '#FFFFFF', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
    appleText: { color: '#000000', fontSize: 16, fontWeight: '600' },
    googleMark: { width: 20, height: 20 },
    secondaryText: { color: c.text, fontSize: 16 },
    disabled: { opacity: 0.4 },
    links: { marginTop: 28, gap: 16, alignItems: 'center' },
    link: { color: c.accent, fontSize: 14 },
    muted: { color: c.muted, fontSize: 13 },
    legal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
    pipe: { color: c.muted, fontSize: 13, opacity: 0.6 },
  });

export type AuthStyles = ReturnType<typeof makeStyles>;
