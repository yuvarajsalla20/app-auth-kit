import { coded } from '../errors';

/** Supabase error codes, turned into the kit's `auth/...` codes so the same texts (and the app's own overrides) apply. */
const CODES: Record<string, string> = {
  invalid_credentials: 'auth/invalid-credential',
  user_not_found: 'auth/user-not-found',
  email_address_invalid: 'auth/invalid-email',
  user_already_exists: 'auth/email-already-in-use',
  email_exists: 'auth/email-already-in-use',
  weak_password: 'auth/weak-password',
  same_password: 'auth/same-password',
  over_request_rate_limit: 'auth/too-many-requests',
  over_email_send_rate_limit: 'auth/too-many-requests',
  over_sms_send_rate_limit: 'auth/too-many-requests',
  email_not_confirmed: 'auth/email-not-confirmed',
  provider_disabled: 'auth/operation-not-allowed',
  email_provider_disabled: 'auth/operation-not-allowed',
  signup_disabled: 'auth/operation-not-allowed',
  reauthentication_needed: 'auth/requires-recent-login',
  session_not_found: 'auth/requires-recent-login',
  identity_already_exists: 'auth/account-exists-with-different-credential',
  bad_jwt: 'auth/missing-token',
};

interface SupabaseLikeError {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}

/** A Supabase error as a coded Error. A lost connection becomes `auth/network-request-failed`; an unknown code keeps it as `supabase/<code>`. */
export const fromSupabase = (error: unknown): Error => {
  const e = (error ?? {}) as SupabaseLikeError;
  const message = e.message || 'Supabase error';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || /failed to fetch|network request failed/i.test(message)) return coded(message, 'auth/network-request-failed');
  if (e.code && CODES[e.code]) return coded(message, CODES[e.code]);
  // Older servers send no code for a wrong password.
  if (/invalid login credentials/i.test(message)) return coded(message, 'auth/invalid-credential');
  return coded(message, e.code ? (e.code.includes('/') ? e.code : `supabase/${e.code}`) : '');
};

/** Unwraps `{ data, error }`: returns the data, or throws the error as a coded Error. */
export const unwrap = async <R extends { data: unknown; error: unknown }>(call: PromiseLike<R>): Promise<R['data']> => {
  const { data, error } = await call;
  if (error) throw fromSupabase(error);
  return data;
};
