import { useRef } from 'react';

const sameValues = (a: object | undefined, b: object | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const [ka, kb] = [Object.keys(a), Object.keys(b)];
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
};

/** Returns the previous object while the new one holds the same values, so an inline `{ ... }` from the parent does not rebuild anything. */
export const useStable = <T extends object | undefined>(value: T): T => {
  const kept = useRef(value);
  if (!sameValues(kept.current, value)) kept.current = value;
  return kept.current;
};
