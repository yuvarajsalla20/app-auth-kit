# Changelog

Upgrade notes for app-auth-kit, newest first. Each version is tagged in git (`v1.14.0`). Every 1.x release is backward compatible unless a note says otherwise.

## 1.20.0

Nothing to change in apps. Existing behaviour is unchanged.

- **Reconfirm.** New `reconfirm(askPassword)` confirms that the signed-in person is still the one using the phone, e.g., for "Forgot PIN" in app-guard-kit. It uses the way they signed up: Apple, their password (the app's `askPassword(email)` returns it, or null when closed), or Google. It re-authenticates the same account and never signs anyone else in. It resolves true when confirmed and false when cancelled, wrong or failed (reported to `onError` as `reconfirm`).
- Delete Account and `reconfirm` now share one identity check (`confirmIdentity.ts`).

## 1.19.0

Nothing to change in apps. iPhone and the web are unchanged.

- **Apple accounts on Android.** Android has no Apple sign-in sheet, so the Android sign-in screen now says, under the sign-in buttons: "Joined with Apple on iPhone? Enter your Apple ID email, tap Forgot Password to set a password, then sign in here." It shows only on Android and only when signing in. New string `appleOnAndroid`; an empty string hides it.

## 1.18.0

Nothing breaks: the new option is optional, and without it `useAuth` behaves exactly as before.

- **Fast start (new):** pass `storage` (AsyncStorage) to `createAuthKit` and the kit remembers the last signed-in person's profile (uid, email, displayName, photoURL and the sign-in method ids; no tokens). On the next launch `useAuth` returns `{ status: 'in', user, confirming: true }` within a few milliseconds, instead of staying `loading` while Firebase refreshes the login over the network (two calls in a row, often one to several seconds on a phone signal). When Firebase answers, the state becomes the confirmed person, `out`, or the other person who is now signed in. The kit reads its own saved copy first and, the first time after an upgrade, the profile fields of Firebase's own saved login.
- The remembered person is forgotten on Sign Out, once Delete Account has removed the login, and whenever Firebase reports nobody.
- While `confirming` is true, `user` has the profile fields only, not Firebase's `User` methods (such as `getIdToken`). Code that needs those should wait for `confirming` to be absent; the apps read only uid, email, displayName and photoURL, which are all there. Firestore calls made meanwhile wait for the login by themselves.
- New exported types: `AuthStorage`, `RememberedUser`. `AuthState` gains the `confirming` field.
- Apps: `createAuthKit({ ..., storage: AsyncStorage })`. When Firebase later reports nobody (the login was revoked elsewhere), the app moves from `in` to `out`, so its normal sign-out path must handle that transition.

## 1.17.0

Nothing breaks: every addition is optional and existing calls work as before. Fixes from the 2026-11-21 review, and two pieces each app used to write itself.

- **Delete Account, start to finish (new):** `createDeleteAccountFlow` (from `app-auth-kit` and `app-auth-kit/supabase`) runs the whole sequence around `deleteAccount`, so the apps stop writing their own (they had drifted apart). The app passes `erase`, `restore`, optional `marker` and `cleanups`. Any failure once the erase has started calls `restore`, at once and also after a time-out while the erase is still running (with a promise for its end); a failure before it puts nothing back. A new try waits for an earlier restore. See the README.
- **Google on Android:** `expoNativeProviders({ googleWebClientId })` offers Google on Android (Apple stays iPhone only), with Sign Out included. Its Sign Out now sets Google up first, which Android needs. New optional `onError(where, error, extra)` reports a failed Google sheet.
- **Google on iPhone:** the fix for "No presenting view controller found" now ships with the kit as `patches/@react-native-google-signin+google-signin+17.0.0.patch`, for patch-package (README, "Google on iPhone, the presenter fix").
- **Supabase Delete Account** checks that Google's or Apple's sheet came back with the same account. Another account is signed out of the phone again and the delete stops with `auth/user-mismatch` before anything is erased. Before, Supabase switched to that account and deleted it instead.
- **Supabase Sign Out** works offline: it clears this phone first (`scope: 'local'`). The person counts as signed out only once the session is really gone; a server error after that goes to `onError('sign-out')`. Before, offline Sign Out kept the person signed in while the kit believed nobody was, so password change and Delete Account stopped working.
- **Delete Account (both kits)**, once the login is gone, forgets the phone's Google account and any held nickname, as Sign Out does.
- The README names the current version again (it said 1.14.1); a test now checks it.

## 1.16.0

- **Features link (opt-in):** new optional `onOpenFeatures` on `SignInScreen` (new string `features`, default "Features"). When passed, "Forgot password?" sits on its own line and "Features | Privacy policy" go on the line under it. Without it the screen looks exactly as before.

## 1.15.1

Nothing to change in apps.

- `KIT_VERSION` matches package.json again (it said 1.14.1 in 1.15.0).
- Switching between sign-in and sign-up clears the confirm box and hides the passwords again, so an old confirm can't match a changed password.
- Passwords show in plain text only while the show/hide button is there to hide them.

## 1.15.0

Nothing to change: both additions are optional and the screen looks the same without them.

- **Confirm password:** `<SignInScreen confirmPassword />` asks for the password twice when creating an account. "Create account" stays off until both match, and "The passwords don't match." shows once the second box differs. Signing in still asks once.
- **Show/hide password:** `<SignInScreen showPassword />` adds a button at the right end of each password box. One tap shows or hides both boxes. It reads Show / Hide by default. Pass `components.PasswordEye` (`{ visible }`) to draw an eye icon instead.
- New strings: `confirmPassword`, `passwordsDiffer`, `show`, `hide`, `showPassword`, `hidePassword`.
- Password boxes no longer auto-capitalize while shown.

## 1.14.1

Nothing to change in apps: the kit's own tests now run on React 19.3.0 and React Native 0.88.1, the versions the apps ship (they ran on React 18.3 and React Native 0.76 before). Code is unchanged.

## 1.14.0

Nothing to change: every addition is optional and the screen looks the same without it.

- `labels` (prop): each box shows a small label ("Email", "Password") above the text, with a hint inside (`strings.emailHint`, `strings.passwordHint`).
- `brand.button`: art drawn inside the main button, behind its words (a gradient), clipped to its corners.
- `theme.field`, `theme.label`, `theme.primary`, `theme.onPrimary`, `theme.glow`: box fill, label color, main button fill and words, and a soft colored glow under the main button.

## 1.13.0

Nothing changes for apps that pass their own `native` functions. New: `app-auth-kit/native` with `expoNativeProviders`, `AppleButton`, `makeAppleButton` and `APPLE_BUTTON`, so an app can delete its own copies.

Sign Out now also signs the phone out of Google (`native.signOut`, which `expoNativeProviders` fills in when Google is set up), so the next person on a shared phone chooses their own Google account. Picking a different Apple or Google account while confirming Delete Account now says so plainly (`auth/user-mismatch`).

## 1.11.0

Nothing changes for Firebase apps: the Firebase files are untouched, and the files that did change compile to the same JavaScript. What is new:

- `app-auth-kit/supabase` (above), with its own tests.
- `SignInScreen` takes any kit that has what the screen uses (`ScreenKit`); the Firebase `AuthKit` fits it as before.
- `AppleResult` and `NativeProviders` moved to `src/providerTypes.ts` and are still exported from the same places.
- `firebase` and `@supabase/supabase-js` are both optional peers: install the one you use. Your app already lists `firebase` because it imports it.

## 1.10.0

The "Continue with Google" button now shows the real four-colour Google logo in front of the words (it was a plain blue letter G). It is built into the kit as a small embedded image, so there is nothing to install and nothing to change in the app. The logo is hidden from VoiceOver; the button is still read as "Continue with Google".

## 1.9.0

- A nickname nobody took is dropped by the next ordinary sign-in, and a nickname is cut by whole characters (an emoji is never split).
- Delete account with a wrong password now says `auth/wrong-current-password` ("Your current password is not correct.") like Change password. Both use `confirmPassword.ts`.
- `strings.resetSent` now reads "If that address has an account, a reset email is on its way..." because an address with no account looks the same as one that has. Reword it through `strings` if you prefer.
- The sign-in screen: Next on the keyboard moves from email to password (and to the nickname when signing up); the main button has a spoken name and a busy state; the form lifts with the keyboard; the entrance animation is shorter, stops with the screen and is skipped when the phone's Reduce Motion is on; an inline `theme` or `strings` object no longer rebuilds the styles. If you pass your own `components.TextInput`, make it `forwardRef` to get the Next-key hand-off; a plain component still works without it.
- The Apple access is revoked before the login is deleted (as before): if the last step fails, `onError('delete-user', error)` is called and the person has to confirm with Apple again on retry. This order was not changed because it could not be tried against real Firebase here.
- `"sideEffects": false`, a version test, and an `.npmrc` for installing this repo on its own.

## 1.8.0

- `useAuth(false)` and `useAuth` with `auth: null` now report `{ status: 'out' }` instead of staying on `loading`, and a listener error does the same and calls `onError('auth-state', error)`. Show your sign-in or "not configured" screen for `out`.
- `signUpEmail` and `changePassword` reject a password shorter than `minPassword` with `auth/weak-password`; `changePassword` also rejects the same password (`auth/same-password`).
- The reset cooldown is per email address. A reset for an address with no account resolves as if it worked.
- `sendPasswordChange` always returns a promise and rejects with `auth/no-password` for Apple or Google only accounts.
- `deleteAccount`: only one runs at a time (`auth/delete-in-progress`); a retry after `auth/delete-timeout` joins the first erase, so make `eraseData` safe to run twice; an account that signs in with a method the kit cannot re-confirm gets `auth/requires-recent-login`; a failed login removal calls `onError('delete-user', error)`.
- Two calls to `signUpEmail` at once make one account.
- Types now live in `types.ts` and are still exported from the package root. New texts: `auth/same-password`, `auth/delete-in-progress`.

