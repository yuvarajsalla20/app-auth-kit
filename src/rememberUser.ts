import type { Auth, User } from 'firebase/auth';

/** Key-value storage on the phone, such as `@react-native-async-storage/async-storage` (pass the default export as is). */
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * The last signed-in person as this phone remembers them. `useAuth` returns it with `confirming: true` at a cold start,
 * before Firebase has refreshed the login. It holds the public profile only: no tokens, and none of Firebase's `User` methods.
 */
export interface RememberedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** The sign-in methods (`password`, `google.com`, `apple.com`), by id only. */
  providerData: { providerId: string }[];
}

/** Where the kit keeps the remembered person. */
export const REMEMBERED_USER_KEY = 'app-auth-kit:lastUser';

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Keeps only the public profile fields, from a Firebase `User` or from saved JSON. Null when there is no uid. */
export const toRemembered = (raw: unknown): RememberedUser | null => {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  if (typeof u.uid !== 'string' || !u.uid) return null;
  const providers = Array.isArray(u.providerData) ? u.providerData : [];
  return {
    uid: u.uid,
    email: str(u.email),
    displayName: str(u.displayName),
    photoURL: str(u.photoURL),
    providerData: providers.flatMap((p) => (p && typeof (p as { providerId?: unknown }).providerId === 'string' ? [{ providerId: (p as { providerId: string }).providerId }] : [])),
  };
};

const parse = (json: string | null): RememberedUser | null => {
  if (!json) return null;
  try {
    return toRemembered(JSON.parse(json));
  } catch {
    return null;
  }
};

/** Firebase's own saved login (React Native persistence), read only for its public fields when the kit has nothing saved yet. */
const firebaseKey = (auth: Auth): string | null => {
  const apiKey = (auth as { config?: { apiKey?: unknown } }).config?.apiKey;
  const name = (auth as { name?: unknown }).name;
  return typeof apiKey === 'string' && apiKey && typeof name === 'string' && name ? `firebase:authUser:${apiKey}:${name}` : null;
};

const same = (a: RememberedUser | null, b: RememberedUser | null) => JSON.stringify(a) === JSON.stringify(b);

export interface UserMemory {
  /** The remembered person once read: undefined while the read is still running, null when there is none. */
  peek(): RememberedUser | null | undefined;
  /** Reads the remembered person (once; later calls share the first read). */
  load(): Promise<RememberedUser | null>;
  /** Saves the person Firebase confirmed. */
  remember(user: User): void;
  /** Forgets the person (signed out, account deleted). */
  forget(): void;
}

/** Remembers the last signed-in person in the app's storage. Every storage failure is reported and otherwise ignored: the kit then simply waits for Firebase as before. */
export const createUserMemory = (auth: Auth, storage: AuthStorage, onError?: (where: string, error: unknown) => void): UserMemory => {
  let value: RememberedUser | null | undefined;
  let reading: Promise<RememberedUser | null> | null = null;
  // True while the kit's own key holds `value` (false when it came from Firebase's saved login).
  let saved = false;
  // Writes run in order, so a quick sign-in then sign-out cannot leave the old person saved.
  let writes: Promise<void> = Promise.resolve();
  const write = (job: () => Promise<void>) => {
    writes = writes.then(job).catch((e) => onError?.('remember-user', e));
  };

  const read = async (): Promise<RememberedUser | null> => {
    const own = parse(await storage.getItem(REMEMBERED_USER_KEY));
    if (own) {
      saved = true;
      return own;
    }
    const key = firebaseKey(auth);
    return key ? parse(await storage.getItem(key)) : null;
  };

  return {
    peek: () => value,
    load: () =>
      (reading ??= read()
        .catch((e) => {
          onError?.('remember-user', e);
          return null;
        })
        .then((found) => {
          // Firebase may have answered while the read ran; its answer wins.
          if (value === undefined) value = found;
          return value;
        })),
    remember: (user) => {
      const next = toRemembered(user);
      if (!next || (saved && same(next, value ?? null))) return;
      value = next;
      saved = true;
      write(() => storage.setItem(REMEMBERED_USER_KEY, JSON.stringify(next)));
    },
    forget: () => {
      const had = value !== null;
      value = null;
      saved = false;
      if (had) write(() => storage.removeItem(REMEMBERED_USER_KEY));
    },
  };
};
