/** The nickname typed at sign-up, held until the app has created the new profile and takes it. */
export const createNickname = (maxLength: number) => {
  let pending: { name: string } | null = null;

  /**
   * Runs a sign-in action. A sign-up passes the typed nickname (even an empty one, which clears any old one);
   * if that sign-up fails it forgets only its own nickname, never a newer one.
   */
  const run = async <T>(action: () => Promise<T>, typed?: string): Promise<T> => {
    const name = typed?.trim().slice(0, maxLength);
    const mine = name ? { name } : null;
    if (typed !== undefined) pending = mine;
    try {
      return await action();
    } catch (e) {
      if (mine && pending === mine) pending = null;
      throw e;
    }
  };

  return {
    run,
    /** Returns the nickname typed at sign-up (once) so the app can save it with the new profile. */
    take: (): string | null => {
      const name = pending?.name ?? null;
      pending = null;
      return name;
    },
    forget: (): void => {
      pending = null;
    },
  };
};
