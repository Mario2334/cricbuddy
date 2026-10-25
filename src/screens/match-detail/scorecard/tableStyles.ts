import { StyleSheet } from 'react-native';
import { colors, curve, glass, palette, radii, shadows, space, text } from '../../../theme';

// Shared look for the batting and bowling tables: frosted glass card with a
// light rim, faint emerald header, zebra rows, fixed-width right-aligned
// tabular-number columns. The shadow sits on `card`; `clip` rounds the rows.
export const tableStyles = StyleSheet.create({
  card: {
    backgroundColor: glass.fillStrong,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    ...curve,
    ...shadows.glass,
  },
  clip: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...curve,
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: glass.rim,
    ...curve,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  titleIcon: { marginRight: space.sm + 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  rowAlt: { backgroundColor: 'rgba(15,23,42,0.025)' },
  nameCell: { flex: 1, paddingRight: space.sm },
  num: { ...text.mono, textAlign: 'right' },
  headText: { ...text.caption, letterSpacing: 0.4, color: colors.textMuted, textAlign: 'right' },
  headName: { ...text.caption, letterSpacing: 0.4, color: colors.textMuted, flex: 1 },
  notOutBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: palette.green500,
  },
});
