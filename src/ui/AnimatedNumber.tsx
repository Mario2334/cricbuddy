import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AppText } from './AppText';
import type { TextVariant } from '../theme';

interface AnimatedNumberProps {
  value: string | number;
  duration?: number;
  delay?: number;
  /** Flip to true (again) to replay the count-up from zero. */
  play?: boolean;
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
}

const NUMERIC = /^-?[\d,]*\.?\d+$/;

function formatLike(template: string, n: number): string {
  const decimals = template.includes('.') ? template.split('.')[1].length : 0;
  const fixed = n.toFixed(decimals);
  if (!template.includes(',')) return fixed;
  const [int, dec] = fixed.split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${withCommas}.${dec}` : withCommas;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts up to numeric values (keeping decimals and commas); other text shows
 * as-is. The first play (and every replay) counts from zero; later value
 * changes, like a live score ticking over, roll on from the previous value.
 */
export function AnimatedNumber({ value, duration = 900, delay = 0, play = true, variant = 'number', color, style }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const raw = String(value ?? '');
  const isNumeric = NUMERIC.test(raw.trim());
  const target = isNumeric ? parseFloat(raw.replace(/,/g, '')) : 0;
  const [display, setDisplay] = useState(isNumeric && play && !reduced ? formatLike(raw, 0) : raw);
  const frame = useRef<number | null>(null);
  const shown = useRef(0);
  const lastPlay = useRef(false);

  useEffect(() => {
    const replay = play && !lastPlay.current;
    lastPlay.current = play;
    if (!isNumeric || reduced || !play) {
      shown.current = target;
      setDisplay(raw);
      return;
    }
    const from = replay ? 0 : shown.current;
    if (from === target) {
      setDisplay(raw);
      return;
    }
    let start: number | null = null;
    setDisplay(formatLike(raw, from));
    const timeout = setTimeout(
      () => {
        const step = (ts: number) => {
          if (start === null) start = ts;
          const t = Math.min(1, (ts - start) / duration);
          const current = from + (target - from) * easeOutCubic(t);
          shown.current = current;
          setDisplay(formatLike(raw, current));
          if (t < 1) frame.current = requestAnimationFrame(step);
        };
        frame.current = requestAnimationFrame(step);
      },
      replay ? delay : 0,
    );
    return () => {
      clearTimeout(timeout);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [raw, isNumeric, target, duration, delay, play, reduced]);

  return (
    <AppText variant={variant} color={color} style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={1} adjustsFontSizeToFit>
      {display}
    </AppText>
  );
}

export default AnimatedNumber;
