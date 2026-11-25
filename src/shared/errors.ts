/** An Error carrying a Firebase-style `code`, so `message()` can turn it into plain words. */
export const coded = (message: string, code: string): Error => Object.assign(new Error(message), { code });

/** The `code` of a thrown value, or '' when it has none. */
export const codeOf = (error: unknown): string => (error as { code?: string })?.code ?? '';
