# app-auth-kit

Reusable Firebase sign-in for React Native / Expo apps (iOS, Android, web).
Themeable screen + auth functions + sign-in state hook, with nothing specific to any one app.

## What you get

| Piece | What it does |
|---|---|
| `createAuthKit({ auth })` | Sign in, sign up (+ optional nickname), Google (web), forgot password, change password (emailed link), sign out, delete account, `useAuth()` hook, friendly error text |
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
await authKit.deleteAccount(password, async () => { /* erase this app's own data */ });
const nickname = authKit.takeNickname();               // after sign-up, save it with the new profile
```

## Rules it follows

- Delete account re-authenticates first, runs **your** `eraseData` callback, then removes the login, and gives up after 30 s so it never hangs.
- A failed sign-up never leaves its nickname behind for the next login; sign-out clears it.
- Wrong email, wrong password and unknown user all show the same message.
- Every word on the screen can be reworded through `strings`.

## Install

`"app-auth-kit": "github:yuvarajsalla20/app-auth-kit#v1.0.0"` in `package.json`.
Peer dependencies: `firebase`, `react`, `react-native`, `react-native-safe-area-context`.

---
Version 1.0.0 - 2026-11-02 08:20 CST
