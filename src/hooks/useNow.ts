import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { msUntilNextMidnight } from '../utils/dates';

interface UseNowOptions {
  /** Pause ticking (e.g. when the screen is not focused). Default true. */
  enabled?: boolean;
  /** Align ticks to the interval boundary (whole seconds/minutes). */
  align?: boolean;
}

/**
 * Current time that re-renders every `intervalMs`, rolls over at local
 * midnight, and refreshes immediately when the app returns to foreground
 * (JS timers freeze while backgrounded).
 */
export function useNow(intervalMs = 60_000, { enabled = true, align = false }: UseNowOptions = {}): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(new Date());
    tick();

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const alignDelay = align ? intervalMs - (Date.now() % intervalMs) : intervalMs;
    const alignId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, intervalMs);
    }, alignDelay);

    let midnightId: ReturnType<typeof setTimeout>;
    const armMidnight = () => {
      midnightId = setTimeout(() => {
        tick();
        armMidnight();
      }, msUntilNextMidnight(new Date()) + 250);
    };
    armMidnight();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') tick();
    });

    return () => {
      clearTimeout(alignId);
      if (intervalId) clearInterval(intervalId);
      clearTimeout(midnightId);
      sub.remove();
    };
  }, [intervalMs, enabled, align]);

  return now;
}
