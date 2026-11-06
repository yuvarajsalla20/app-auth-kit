# app-auth-kit

Reusable Firebase or Supabase sign-in for React Native / Expo apps (iOS, Android, web).
Themeable screen + auth functions + sign-in state hook, with nothing specific to any one app.

## What you get

| Piece | What it does |
|---|---|
| `createAuthKit({ auth })` | Sign in, sign up (+ optional nickname), Google and Apple (native sheets supplied by the app), forgot password, change password (emailed link), sign out, delete account, `useAuth()` hook, friendly error text |
| `<SignInScreen />` | The sign-in / create-account screen. Looks come from `theme`, `brand`, `components`, `strings` |

## Use it

```ts
// authKit.ts  (one per app)
import { createAuthKit } from 'app-auth-kit';
import { auth } from './firebase';            // your Firebase Auth, or null while unconfigured

export const authKit = createAuthKit({ auth, google: Platform.OS === 'web', minPassword: 8, maxNickname: 20 });
```

```tsx
// SignInScreen.tsx
import { SignInScreen } from 'app-auth-kit';

<SignInScreen
  kit={authKit}
  brand={{ name: 'MyApp', tagline: 'Say something nice.', logo: <Logo />, backdrop: <Stars /> }}
  theme={{ bg: '#000', accent: '#5B8CFF' }}   // only what differs from the defaults (an inline object is fine: it is compared by value)
  components={{ Text, TextInput }}             // your font-aware components (optional)
  nickname                                      // ask for a nickname at sign-up (optional)
  onOpenPrivacy={() => Linking.openURL(PRIVACY_URL)}
/>
```

```tsx
// Anywhere
const auth = authKit.useAuth(isFirebaseConfigured);   // { status: 'loading' | 'out' | 'in', user }
await authKit.sendPasswordChange();                    // "Change password": emails a link to the signed-in address
await authKit.changePassword(current, next);            // "Change password" on a page: confirms the current password, then sets the new one
                                                        // with app-account-kit: password={{ onChange: authKit.changePassword, minLength: authKit.minPassword }}
await authKit.deleteAccount(password, async () => { /* erase this app's own data */ });
const nickname = authKit.takeNickname();               // after sign-up, save it with the new profile
```

## Supabase instead of Firebase (v1.11)

Import from `app-auth-kit/supabase` and pass your Supabase client. You get the same kit: the same actions, rules, error texts and `SignInScreen`. That entry imports nothing from Firebase (a test walks its imports), and Firebase apps that import `app-auth-kit` work exactly as before.

```ts
// authKit.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseAuthKit } from 'app-auth-kit/supabase';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } });
export const authKit = createSupabaseAuthKit({
  supabase,                                   // or null while unconfigured
  native: { google: googleIdToken, apple: appleSheet },  // the same phone sheets as the Firebase kit
  resetRedirectTo: 'myapp://reset-password',  // must be in Supabase > Authentication > URL Configuration
  revokeApple: (code) => supabase.functions.invoke('revoke-apple', { body: { code } }).then(() => {}),
});
```

```tsx
import { SignInScreen } from 'app-auth-kit/supabase';
<SignInScreen kit={authKit} brand={{ name: 'MyApp' }} />
const auth = authKit.useAuth();              // { status: 'loading' | 'out' | 'in', user }  (a Supabase User)
```

What is different on Supabase:

- **Delete account needs one database function**, because a phone cannot delete a Supabase login itself. By default the kit calls `delete_user`; run this once in the SQL editor (or pass your own `deleteUser`, for example an Edge Function):

  ```sql
  create or replace function public.delete_user() returns void
  language sql security definer set search_path = '' as $$
    delete from auth.users where id = auth.uid();
  $$;
  revoke execute on function public.delete_user() from public, anon;
  grant execute on function public.delete_user() to authenticated;
  ```

  After it, the saved session on the phone is cleared (`signOut({ scope: 'local' })`).
- **Apple revoke** needs Apple's client secret, so it runs on your server: pass `revokeApple(code)`. Without it the account is still deleted. A failed revoke calls `onError('apple-revoke', error)` and the delete goes on, like the Firebase kit.
- **Email confirmation**: if the project asks people to confirm their email, sign-up has no session yet and rejects with `auth/check-email` ("Check your email and tap the link..."). Supabase answers the same way for an address that already has an account, so the screen cannot reveal who has one. The typed nickname is not carried to that later sign-in.
- **Web Google** goes through Supabase's redirect (`oauthRedirectTo`). On the web, delete account with Google relies on the open session (Supabase has no popup re-check); phones confirm with Google's sheet.
- Supabase error codes are turned into the same `auth/...` codes, so your `messages` overrides keep working. An unknown one shows as `supabase/<code>`.
- Set `minPassword` to the minimum in Supabase > Authentication > Providers > Email.

## Rules it follows

- Delete account re-authenticates first, runs **your** `eraseData` callback, then removes the login, and gives up after 30 s so it never hangs.
- A failed sign-up never leaves its nickname behind for the next login; sign-out clears it.
- Reset and change-password emails are limited to one per minute per address, and an address with no account looks the same as one that has.
- Passwords must meet `minPassword` at sign-up and when changed, and a changed password must differ from the old one.
- Only one delete runs at a time; a retry after a timeout joins the first erase, so `eraseData` runs once and must be safe to run again.
- `useAuth` reports signed out (never stuck loading) when Firebase is not configured or the listener fails.
- A double tap on sign-up makes one account and keeps its nickname.
- Wrong email, wrong password and unknown user all show the same message.
- Every word on the screen can be reworded through `strings`.

## Folder layout

```
src/
  createAuthKit.ts     puts the pieces below together and returns the kit
  types.ts             AuthKitOptions, AuthState (Firebase)
  providerTypes.ts     NativeProviders, AppleResult (shared, no backend)
  screenKit.ts         ScreenKit: what the sign-in screen needs from a kit (both kits fit it)
  nickname.ts          the nickname typed at sign-up (kept once, cut by whole characters, forgotten on failure, sign-out or the next ordinary sign-in)
  resetCooldown.ts     one reset email per address per minute
  passwordRules.ts     the password rules shared by sign-up and change password
  confirmPassword.ts   signs the person in again with their password (shared by change password and delete account)
  passwordActions.ts   change password (confirm current, then set) and the emailed link
  providers.ts         which sign-in methods the person uses; the Apple and Google credentials
  deleteAccount.ts     re-confirm, erase the app's data once, revoke Apple, remove the login
  useAuth.ts           the sign-in state hook
  errors.ts  messages.ts   error codes and the plain-language texts
  supabase/            the Supabase kit: createSupabaseAuthKit, providers, deleteAccount, useSupabaseAuth, errors (Supabase codes to auth/... codes), messages
  SignInScreen.tsx     the screen; useAuthForm.ts, AuthFields.tsx, SocialButtons.tsx, AuthLinks.tsx, signInStyles.ts, useStable.ts, Reveal.tsx, googleMark.ts (the Google logo) are its parts
tests/                 vitest, with stand-ins for firebase/auth and app-core-kit in tests/stubs/; tests/supabase.test.tsx uses a stand-in Supabase client
typetests/             compile-time checks that both kits fit the screen and share the same actions
supabase.ts            the `app-auth-kit/supabase` entry
```

## Tests

`npm install` (an `.npmrc` keeps npm from looking for app-core-kit on the registry) then `npm test` (vitest, 88 tests: 59 for Firebase and the screen, 29 for Supabase, including the real sign-in screen rendered with a small react-native stand-in) and `npm run typecheck`. The tests use stand-ins for `firebase/auth` and `app-core-kit` (`tests/stubs/`).

## Upgrading from 1.10 to 1.11

Nothing changes for Firebase apps: the Firebase files are untouched, and the files that did change compile to the same JavaScript. What is new:

- `app-auth-kit/supabase` (above), with its own tests.
- `SignInScreen` takes any kit that has what the screen uses (`ScreenKit`); the Firebase `AuthKit` fits it as before.
- `AppleResult` and `NativeProviders` moved to `src/providerTypes.ts` and are still exported from the same places.
- `firebase` and `@supabase/supabase-js` are both optional peers: install the one you use. Your app already lists `firebase` because it imports it.

## Upgrading from 1.9 to 1.10

The "Continue with Google" button now shows the real four-colour Google logo in front of the words (it was a plain blue letter G). It is built into the kit as a small embedded image, so there is nothing to install and nothing to change in the app. The logo is hidden from VoiceOver; the button is still read as "Continue with Google".

## Upgrading from 1.8 to 1.9

- A nickname nobody took is dropped by the next ordinary sign-in, and a nickname is cut by whole characters (an emoji is never split).
- Delete account with a wrong password now says `auth/wrong-current-password` ("Your current password is not correct.") like Change password. Both use `confirmPassword.ts`.
- `strings.resetSent` now reads "If that address has an account, a reset email is on its way..." because an address with no account looks the same as one that has. Reword it through `strings` if you prefer.
- The sign-in screen: Next on the keyboard moves from email to password (and to the nickname when signing up); the main button has a spoken name and a busy state; the form lifts with the keyboard; the entrance animation is shorter, stops with the screen and is skipped when the phone's Reduce Motion is on; an inline `theme` or `strings` object no longer rebuilds the styles. If you pass your own `components.TextInput`, make it `forwardRef` to get the Next-key hand-off; a plain component still works without it.
- The Apple access is revoked before the login is deleted (as before): if the last step fails, `onError('delete-user', error)` is called and the person has to confirm with Apple again on retry. This order was not changed because it could not be tried against real Firebase here.
- `"sideEffects": false`, a version test, and an `.npmrc` for installing this repo on its own.

## Upgrading from 1.7 to 1.8

- `useAuth(false)` and `useAuth` with `auth: null` now report `{ status: 'out' }` instead of staying on `loading`, and a listener error does the same and calls `onError('auth-state', error)`. Show your sign-in or "not configured" screen for `out`.
- `signUpEmail` and `changePassword` reject a password shorter than `minPassword` with `auth/weak-password`; `changePassword` also rejects the same password (`auth/same-password`).
- The reset cooldown is per email address. A reset for an address with no account resolves as if it worked.
- `sendPasswordChange` always returns a promise and rejects with `auth/no-password` for Apple or Google only accounts.
- `deleteAccount`: only one runs at a time (`auth/delete-in-progress`); a retry after `auth/delete-timeout` joins the first erase, so make `eraseData` safe to run twice; an account that signs in with a method the kit cannot re-confirm gets `auth/requires-recent-login`; a failed login removal calls `onError('delete-user', error)`.
- Two calls to `signUpEmail` at once make one account.
- Types now live in `types.ts` and are still exported from the package root. New texts: `auth/same-password`, `auth/delete-in-progress`.

## Install

`"app-auth-kit": "git+https://github.com/yuvarajsalla20/app-auth-kit.git#<full commit SHA>"` in `package.json`. Pin a full commit SHA, not a tag, so a build always gets exactly the code you tested.
Peer dependencies: `app-core-kit` (install it from GitHub too, pinned the same way), `firebase`, `react`, `react-native`, `react-native-safe-area-context`.

## Apple and Google on phones (v1.2)

The kit has no native dependencies. The app supplies the phone's sign-in sheets; the kit signs the token in to Firebase,
shows the buttons, re-confirms with the same method before deleting an account, and revokes Apple's token on delete.

```ts
createAuthKit({
  auth,
  native: {
    apple: async () => ({ idToken, rawNonce, authorizationCode }),  // null if cancelled
    google: async () => idToken,                                     // null if cancelled
  },
});
```

`onError(where, error)` receives quiet failures such as a failed Apple token revoke. `confirmsWithPassword()` says whether delete-account needs the password typed (false when Apple confirms).

Pass `components={{ AppleButton }}` to use Apple's own button (recommended for App Store review).
Firebase console: enable the Apple and Google providers, and keep "Link accounts that use the same email" on.

Version: `import { KIT_VERSION } from 'app-auth-kit'` gives the installed version. Pass it, with the other kits' versions, to the account kit's `kitsLine` so the app can show and report every kit version in one line.

---
Version 1.10.0 - 2026-11-04 11:40 PM CT
