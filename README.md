# app-auth-kit

Sign-in for React Native and Expo apps (iOS, Android and web), on **Firebase** or **Supabase**: a themeable sign-in screen, the auth functions, a sign-in state hook, password reset and change, and account deletion. Nothing in it is specific to any one app.

**Current version: 1.14.0** (tag `v1.14.0`)

Part of the shared kits:
[app-core-kit](https://github.com/yuvarajsalla20/app-core-kit) ·
**app-auth-kit** ·
[app-account-kit](https://github.com/yuvarajsalla20/app-account-kit) ·
[app-settings-kit](https://github.com/yuvarajsalla20/app-settings-kit) ·
[app-subscriptions-kit](https://github.com/yuvarajsalla20/app-subscriptions-kit) ·
[app-payments-kit](https://github.com/yuvarajsalla20/app-payments-kit) ·
[app-export-kit](https://github.com/yuvarajsalla20/app-export-kit)

## Install

```jsonc
// package.json
"dependencies": {
  "app-core-kit": "git+https://github.com/yuvarajsalla20/app-core-kit.git#<full SHA of v1.6.1>",
  "app-auth-kit": "git+https://github.com/yuvarajsalla20/app-auth-kit.git#<full SHA of v1.14.0>"
},
"kitVersions": {
  "app-core-kit": "v1.6.1",
  "app-auth-kit": "v1.14.0"
}
```

Pin the full commit SHA of a release tag, and write the tag in `kitVersions`. Find a SHA with `git ls-remote https://github.com/yuvarajsalla20/app-auth-kit refs/tags/v1.14.0`.

**Peer dependencies:**

| Package | Needed for |
|---|---|
| `app-core-kit` ≥ 1.3.0, `react` ≥ 18, `react-native` ≥ 0.74, `react-native-safe-area-context` ≥ 4 | Always |
| `firebase` ≥ 11 | The Firebase kit (`app-auth-kit`) |
| `@supabase/supabase-js` ≥ 2.39 | The Supabase kit (`app-auth-kit/supabase`) |
| `expo-apple-authentication` ≥ 6, `expo-crypto` ≥ 13, `@react-native-google-signin/google-signin` ≥ 13 | The ready-made phone sheets (`app-auth-kit/native`). Need a development build, not Expo Go |

All but the first row are optional: install the ones you use.

## Entry points

| Import | What it holds |
|---|---|
| `app-auth-kit` | The Firebase kit: `createAuthKit`, `SignInScreen`, `DEFAULT_THEME`, `DEFAULT_STRINGS`, `DEFAULT_MESSAGES`, `KIT_NAME`, `KIT_VERSION` and the types |
| `app-auth-kit/supabase` | The same kit on Supabase: `createSupabaseAuthKit` and its `SignInScreen`. Imports nothing from Firebase (a test walks its imports) |
| `app-auth-kit/native` | `expoNativeProviders`, `AppleButton`, `makeAppleButton`, `APPLE_BUTTON`: the Apple and Google sheets an Expo app would otherwise write itself |

## Quick start (Firebase)

```ts
// authKit.ts (one per app)
import { Platform } from 'react-native';
import { createAuthKit } from 'app-auth-kit';
import { expoNativeProviders } from 'app-auth-kit/native';
import { reportError } from 'app-core-kit';
import { auth } from './firebase';                 // your Firebase Auth, or null while unconfigured

export const authKit = createAuthKit({
  auth,
  native: expoNativeProviders({ os: Platform.OS, googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }),
  google: Platform.OS === 'web',                   // Google's popup on the web
  minPassword: 8,
  maxNickname: 20,
  onError: reportError,
});
```

```tsx
// The sign-in screen
import { SignInScreen } from 'app-auth-kit';
import { AppleButton } from 'app-auth-kit/native';

<SignInScreen
  kit={authKit}
  brand={{ name: 'MyApp', tagline: 'Say something nice.', logo: <Logo />, backdrop: <Stars />, button: <Gradient /> }}
  theme={{ bg: '#06201d', accent: '#5eead4' }}     // only what differs from DEFAULT_THEME (compared by value, inline is fine)
  components={{ Text, TextInput, AppleButton }}    // your font-aware components, and Apple's own button
  labels                                           // a small label above each box
  nickname                                         // ask for a nickname at sign-up
  onOpenPrivacy={() => Linking.openURL(PRIVACY_URL)}
/>
```

```tsx
// Anywhere
const auth = authKit.useAuth(isFirebaseConfigured);  // { status: 'loading' | 'out' | 'in', user }
await authKit.changePassword(current, next);         // confirms the current password, then sets the new one
await authKit.deleteAccount(password, async () => { /* erase this app's own data */ });
const nickname = authKit.takeNickname();              // after sign-up, save it with the new profile
```

With app-account-kit or app-settings-kit:

```tsx
password={authKit.hasPassword() ? { onChange: authKit.changePassword, minLength: authKit.minPassword } : undefined}
actions={{ onSignOut: authKit.signOut, onDeleteAccount: (pw) => authKit.deleteAccount(pw, eraseMyData), confirmsWithPassword: authKit.confirmsWithPassword() }}
describeError={authKit.message}
```

## `createAuthKit` options

| Option | Notes |
|---|---|
| `auth` | Firebase `Auth`, or `null` while unconfigured (then `useAuth` reports signed out) |
| `native` | `{ apple?, google?, signOut? }`: the phone's sign-in sheets. Use `expoNativeProviders(...)` or write your own |
| `google` | `true` for Google's popup on the web |
| `minPassword` | Shortest password at sign-up and change. Default 8 |
| `maxNickname` | Longest nickname, cut by whole characters |
| `onError` | `(where, error)` for quiet failures (Apple revoke, Google sign-out, the auth listener) |
| `messages` | Reword the error texts, keyed by `auth/...` code |
| `deleteTimeoutMs` | How long delete may run. Default 30 s |
| `resetCooldownMs` | Time between reset emails to one address. Default one minute |

## The kit's API

| Member | What it does |
|---|---|
| `useAuth(configured?)` | `{ status: 'loading' \| 'out' \| 'in', user }` |
| `signInEmail(email, password)`, `signUpEmail(email, password, nickname?)` | Email sign-in and sign-up |
| `signInGoogle()`, `signInApple()` | Social sign-in (the app supplies the sheets through `native`) |
| `google`, `apple` | Whether each button shows |
| `sendPasswordReset(email)` | The "Forgot password" email |
| `changePassword(current, next)`, `sendPasswordChange()` | Change on a page, or email a link |
| `hasPassword()`, `confirmsWithPassword()` | Whether the login has a password, and whether delete needs it typed (false when Apple confirms) |
| `deleteAccount(password, eraseData)` | Re-confirms, runs your `eraseData`, revokes Apple, removes the login |
| `signOut()` | Signs out, and out of Google on the phone too |
| `takeNickname()` | The nickname typed at sign-up, once |
| `message(error)` | Plain words for an error |
| `minPassword`, `maxNickname` | The rules in use |

## `SignInScreen` props

| Prop | Notes |
|---|---|
| `kit` | **Required.** Either kit (anything that fits `ScreenKit`) |
| `brand` | **Required.** `{ name, tagline?, logo?, backdrop?, button? }`. `button` is art drawn inside the main button, behind its words (a gradient) |
| `theme` | `Partial<AuthTheme>` |
| `strings` | `Partial<AuthStrings>`: every word on the screen |
| `components` | `{ Text?, TextInput?, AppleButton? }`. A custom `TextInput` should `forwardRef` so the keyboard's Next key moves between boxes |
| `labels` | A small label ("Email", "Password") above each box, with a hint inside |
| `nickname` | Ask for a nickname at sign-up |
| `forgotPassword` | Show "Forgot password" (default on) |
| `onOpenPrivacy` | Adds the privacy link |

## Theming

`theme` takes only what differs from `DEFAULT_THEME`:

| Key | What it colors |
|---|---|
| `bg`, `surface`, `border` | Page, cards and their edges |
| `text`, `muted` | Words |
| `accent`, `danger` | Links and highlights; errors |
| `field`, `label` | Text box fill; the label above it (with `labels`) |
| `primary`, `onPrimary` | The main button and its words (default: the accent) |
| `glow` | A soft colored glow under the main button |

The entrance animation is skipped when the phone's Reduce Motion is on.

## Apple and Google on phones

The kit itself has no native dependencies. `app-auth-kit/native` gives an Expo app the ready-made pieces:

```ts
import { AppleButton, makeAppleButton, expoNativeProviders } from 'app-auth-kit/native';

createAuthKit({ auth, native: expoNativeProviders({ os: Platform.OS, googleIosClientId: GOOGLE_IOS_CLIENT_ID }) });
<SignInScreen kit={authKit} components={{ Text, TextInput, AppleButton }} brand={...} />
```

`expoNativeProviders` offers Apple on iPhone, and Google once its client ID is set (empty hides it). `AppleButton` is Apple's own button in the approved size (white, 52 pt, 14 pt corners); `makeAppleButton({ dark: true })` makes a black one for a light screen. Apple's own button is recommended for App Store review.

To write your own sheets instead:

```ts
createAuthKit({
  auth,
  native: {
    apple: async () => ({ idToken, rawNonce, authorizationCode }),  // null if cancelled
    google: async () => idToken,                                     // null if cancelled
    signOut: async () => { /* forget the phone's Google account */ },
  },
});
```

**Firebase console:** enable Email/Password, Apple and Google, and keep "Link accounts that use the same email" on. Google on iPhone needs the Google iOS client ID and a development or TestFlight build.

## Supabase instead of Firebase

Import from `app-auth-kit/supabase` and pass your Supabase client. You get the same actions, rules, error texts and `SignInScreen`.

```ts
// authKit.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseAuthKit } from 'app-auth-kit/supabase';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export const authKit = createSupabaseAuthKit({
  supabase,                                              // or null while unconfigured
  native: { google: googleIdToken, apple: appleSheet },  // the same phone sheets as the Firebase kit
  resetRedirectTo: 'myapp://reset-password',             // must be in Supabase > Authentication > URL Configuration
  revokeApple: (code) => supabase.functions.invoke('revoke-apple', { body: { code } }).then(() => {}),
});
```

```tsx
import { SignInScreen } from 'app-auth-kit/supabase';

<SignInScreen kit={authKit} brand={{ name: 'MyApp' }} />
const auth = authKit.useAuth();   // { status: 'loading' | 'out' | 'in', user } (a Supabase User)
```

What is different on Supabase:

- **Delete account needs one database function**, because a phone cannot delete a Supabase login itself. By default the kit calls `delete_user`; run this once in the SQL editor (or pass your own `deleteUser`, such as an Edge Function):

  ```sql
  create or replace function public.delete_user() returns void
  language sql security definer set search_path = '' as $$
    delete from auth.users where id = auth.uid();
  $$;
  revoke execute on function public.delete_user() from public, anon;
  grant execute on function public.delete_user() to authenticated;
  ```

  Afterwards the saved session on the phone is cleared (`signOut({ scope: 'local' })`).
- **Apple revoke** needs Apple's client secret, so it runs on your server: pass `revokeApple(code)`. Without it the account is still deleted. A failed revoke calls `onError('apple-revoke', error)` and the delete goes on.
- **Email confirmation:** if the project asks people to confirm their email, sign-up has no session yet and rejects with `auth/check-email`. Supabase answers the same way for an address that already has an account, so the screen cannot reveal who has one.
- **Web Google and web Apple** go through Supabase's redirect (`oauthRedirectTo`). Web Apple needs an Apple Services ID and client secret in Supabase. On the web, delete account relies on the open session.
- Supabase error codes become the same `auth/...` codes, so your `messages` keep working. An unknown one shows as `supabase/<code>`.
- Set `minPassword` to the minimum in Supabase > Authentication > Providers > Email.

## Rules it follows

- Delete account re-confirms the person first, runs **your** `eraseData`, revokes Apple, then removes the login, and gives up after 30 s so it never hangs. Only one delete runs at a time; a retry after a timeout joins the first, so `eraseData` runs once and must be safe to run again.
- Wrong email, wrong password and unknown user all show the same message. Reset emails are limited to one per minute per address, and an address with no account looks the same as one that has.
- Passwords must meet `minPassword` at sign-up and when changed, and a new password must differ from the old one.
- A failed sign-up never leaves its nickname behind; sign-out clears it. A double tap on sign-up makes one account.
- `useAuth` reports signed out (never stuck loading) when Firebase is not configured or the listener fails.
- Sign out also signs the phone out of Google, so the next person picks their own account. Picking a different Apple or Google account while confirming Delete says so (`auth/user-mismatch`).
- Every word can be reworded through `strings` and `messages`.

## Folder layout

```
src/
  createAuthKit.ts     puts the pieces together and returns the Firebase kit
  types.ts             AuthKitOptions, AuthState
  providerTypes.ts     NativeProviders, AppleResult (shared by both kits)
  screenKit.ts         what the sign-in screen needs from a kit
  nickname.ts  resetCooldown.ts  passwordRules.ts  confirmPassword.ts  passwordActions.ts
  providers.ts         which sign-in methods the person uses; Apple and Google credentials
  deleteAccount.ts     re-confirm, erase once, revoke Apple, remove the login
  useAuth.ts  errors.ts  messages.ts  theme.ts  kit.ts
  SignInScreen.tsx     the screen, with useAuthForm, AuthFields, SocialButtons, AuthLinks, signInStyles, Reveal, googleMark
  native/              expoNativeProviders and AppleButton (app-auth-kit/native)
  supabase/            the Supabase kit (app-auth-kit/supabase)
tests/                 vitest, with stand-ins for firebase/auth, app-core-kit and a Supabase client in tests/stubs/
typetests/             compile-time checks that both kits fit the screen and share the same actions
native.ts supabase.ts  the entry files
```

## Development

```bash
npm install          # an .npmrc keeps npm from looking for app-core-kit on the registry
npm run typecheck
npm test
```

To release: bump `version` in `package.json` and `KIT_VERSION` in `src/kit.ts` (a test checks they match), add a note to [CHANGELOG.md](CHANGELOG.md), merge, then tag the merged commit.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
