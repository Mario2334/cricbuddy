import { useRef, useState } from 'react';
import { msUntilNextMidnight } from '../utils/dates';
import { useScreenActivity } from './useScreenActivity';

interface UseNowOptions {
  /** Pause ticking (e.g. while a sheet is closed). Default true. */
  enabled?: boolean;
  /** Align ticks to the interval boundary (whole seconds/minutes). */
  align?: boolean;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Current time that re-renders every `intervalMs` and rolls over at local
 * midnight. Ticks only while the screen is focused and the app is in the
 * foreground; coming back catches up at once, skipping the re-render when the
 * interval hasn't rolled over yet.
 */
export function useNow(intervalMs = 60_000, { enabled = true, align = false }: UseNowOptions = {}): Date {
  const [now, setNow] = useState(() => new Date());
  const timers = useRef<Timer[]>([]);

  useScreenActivity(active => {
    timers.current.forEach(id => {
      clearTimeout(id);
      clearInterval(id);
    });
    timers.current = [];
    if (!active) return;

    const tick = () => setNow(new Date());
    setNow(prev => (Math.floor(Date.now() / intervalMs) === Math.floor(prev.getTime() / intervalMs) ? prev : new Date()));

    const alignDelay = align ? intervalMs - (Date.now() % intervalMs) : intervalMs;
    timers.current.push(
      setTimeout(() => {
        tick();
        timers.current.push(setInterval(tick, intervalMs));
      }, alignDelay),
    );
    const armMidnight = () => {
      timers.current.push(
        setTimeout(() => {
          tick();
          armMidnight();
        }, msUntilNextMidnight(new Date()) + 250),
      );
    };
    armMidnight();
  }, enabled);

  return now;
}
