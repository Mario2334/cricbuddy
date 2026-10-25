import { colors, gradients, statusColors } from '../colors';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Glass fill over the brightest emerald blob of the mesh, flattened.
const GLASS_ON_MESH = '#E5FAF0';
const WHITE = '#FFFFFF';

describe('contrast (WCAG AA)', () => {
  it.each([
    ['text', colors.text],
    ['textSoft', colors.textSoft],
    ['textMuted', colors.textMuted],
    ['primaryStrong', colors.primaryStrong],
  ])('%s reads on glass over the mesh', (_name, fg) => {
    expect(contrast(fg, GLASS_ON_MESH)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(statusColors))('%s status chip text reads on its background', (_name, c) => {
    expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('white button labels read across the primary gradient', () => {
    for (const stop of gradients.primary) {
      expect(contrast(WHITE, stop)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
