import { useCallback, useRef } from 'react';

/** A callback whose identity never changes but always calls the latest `fn` (keeps memoized children quiet). */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
