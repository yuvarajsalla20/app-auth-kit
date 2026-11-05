/** The nickname typed at sign-up, held until the app has created the new profile and takes it. */
export const createNickname = (maxLength: number) => {
  let pending: { name: string } | null = null;
  let signUps = 0;

  /**
   * Runs a sign-in action. A sign-up passes the typed nickname (even an empty one, which clears any old one);
   * if that sign-up fails it forgets only its own nickname, never a newer one. Any other sign-in starts by dropping a
   * nickname nobody took, so it can never land on someone else's profile (unless a sign-up is running right now).
   */
  const run = async <T>(action: () => Promise<T>, typed?: string): Promise<T> => {
    // Cut by whole characters, so an emoji is never split in half.
    const name = typed === undefined ? '' : [...typed.trim()].slice(0, maxLength).join('');
    const mine = name ? { name } : null;
    if (typed !== undefined) {
      pending = mine;
      signUps += 1;
    } else if (!signUps) pending = null;
    try {
      return await action();
    } catch (e) {
      if (mine && pending === mine) pending = null;
      throw e;
    } finally {
      if (typed !== undefined) signUps -= 1;
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
