import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, glass, radii, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Avatar } from '../../../ui/Avatar';

export interface PlayerRowProps {
  name: string;
  photo?: string | null;
  /** A slot number drawn in a small circle before the avatar (batting position, XI order). */
  index?: number;
  subtitle?: string;
  /** Second line in soft ink, e.g. the model's one-sentence reason. */
  note?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  dim?: boolean;
  last?: boolean;
  testID?: string;
}

/** One player line used across the Game plan cards. */
export function PlayerRow({ name, photo, index, subtitle, note, right, onPress, dim, last, testID }: PlayerRowProps) {
  const body = (
    <View style={[styles.row, last && styles.last, dim && styles.dim]}>
      {index !== undefined ? (
        <View style={styles.slot}>
          <AppText variant="caption" color={colors.primaryStrong}>
            {index}
          </AppText>
        </View>
      ) : null}
      <Avatar name={name} uri={photo ?? undefined} size={36} />
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color={colors.textSoft} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {note ? (
          <AppText variant="small" color={colors.textSoft} style={styles.note}>
            {note}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => (pressed ? styles.pressed : null)} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.hairline,
  },
  last: { borderBottomWidth: 0 },
  dim: { opacity: 0.55 },
  slot: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fillStrong,
  },
  texts: { flex: 1, minWidth: 0 },
  note: { marginTop: 2 },
  right: { marginLeft: space.xs, alignItems: 'flex-end' },
  pressed: { opacity: 0.7 },
});

export default PlayerRow;
