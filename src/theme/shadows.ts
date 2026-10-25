import type { ViewStyle } from 'react-native';
import { tones, type IconTone } from './colors';

// Layered, diffused shadows (RN 0.76+ `boxShadow` accepts comma-separated lists).
const glassShadow = { boxShadow: '0px 1px 1px rgba(15,23,42,0.03), 0px 12px 32px -10px rgba(6,78,59,0.18)' };

export const glows = Object.fromEntries(
  (Object.keys(tones) as IconTone[]).map(tone => [
    tone,
    { boxShadow: `0px 8px 20px -6px ${tones[tone].glow}, 0px 2px 4px rgba(15,23,42,0.08)` },
  ]),
) as Record<IconTone, ViewStyle>;

export const shadows = {
  none: { boxShadow: 'none' },
  soft: { boxShadow: '0px 1px 2px rgba(15,23,42,0.05), 0px 4px 12px -2px rgba(15,23,42,0.08)' },
  card: { boxShadow: '0px 1px 2px rgba(15,23,42,0.04), 0px 10px 28px -8px rgba(15,23,42,0.14)' },
  glass: glassShadow,
  /** List rows: one small layer. iOS draws boxShadow blurs on the CPU each time a row mounts. */
  row: { boxShadow: '0px 6px 16px -6px rgba(6,78,59,0.16)' },
  float: { boxShadow: '0px 2px 6px rgba(15,23,42,0.06), 0px 18px 44px -12px rgba(15,23,42,0.24)' },
  /** @deprecated use `glass` */
  sticker: glassShadow,
  /** @deprecated use `glows.emerald` */
  stickerGreen: { boxShadow: `0px 8px 20px -6px ${tones.emerald.glow}, 0px 2px 4px rgba(15,23,42,0.08)` },
} satisfies Record<string, ViewStyle>;

export const focusRing: ViewStyle = { boxShadow: '0px 0px 0px 4px rgba(16,185,129,0.22)' };
