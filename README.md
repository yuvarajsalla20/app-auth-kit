# app-auth-kit

Reusable Firebase sign-in for React Native / Expo apps (iOS, Android, web).
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
  theme={{ bg: '#000', accent: '#5B8CFF' }}   // only what differs from the defaults
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
  types.ts             AuthKitOptions, AuthState, NativeProviders, AppleResult
  nickname.ts          the nickname typed at sign-up (kept once, forgotten on failure or sign-out)
  resetCooldown.ts     one reset email per address per minute
  passwordRules.ts     the password rules shared by sign-up and change password
  passwordActions.ts   change password (confirm current, then set) and the emailed link
  providers.ts         which sign-in methods the person uses; the Apple and Google credentials
  deleteAccount.ts     re-confirm, erase the app's data once, revoke Apple, remove the login
  useAuth.ts           the sign-in state hook
  errors.ts  messages.ts   error codes and the plain-language texts
  SignInScreen.tsx     the screen; useAuthForm.ts, AuthFields.tsx, SocialButtons.tsx, AuthLinks.tsx, signInStyles.ts are its parts
tests/                 vitest, with stand-ins for firebase/auth and app-core-kit in tests/stubs/
```

## Tests

`npm install` then `npm test` (vitest, 37 tests) and `npm run typecheck`. The tests use stand-ins for `firebase/auth` and `app-core-kit` (`tests/stubs/`).

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
Peer dependencies: `firebase`, `react`, `react-native`, `react-native-safe-area-context`.

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
Version 1.8.0 - 2026-11-04 4:10 PM CT
