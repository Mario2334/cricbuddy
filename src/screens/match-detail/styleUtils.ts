import { toneOrder, type IconTone } from '../../theme';

/** Append an alpha channel to a 6-digit palette hex (e.g. white at 18%). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/** Rotating icon-tile tone for InfoRow lists (emerald, teal, sky, violet…). */
export function rowTone(index: number): IconTone {
  return toneOrder[index % toneOrder.length];
}
