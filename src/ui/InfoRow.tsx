import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, glass, type IconTone } from '../theme';
import { haptic } from '../utils/haptics';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconTile } from './IconTile';
import type { IconName } from './icons';

export interface InfoRowProps {
  icon?: IconName;
  /** Tile tone (default emerald). */
  tone?: IconTone;
  label: string;
  value?: React.ReactNode;
  onPress?: () => void;
  right?: React.ReactNode;
  numberOfLines?: number;
  /** Show the trailing chevron on pressable rows (default true). */
  showChevron?: boolean;
  last?: boolean;
}

/** Soft icon tile + label/value row used on detail cards. */
export function InfoRow({
  icon,
  tone,
  label,
  value,
  onPress,
  right,
  numberOfLines = 2,
  showChevron = true,
  last,
}: InfoRowProps) {
  const tile = <IconTile icon={icon ?? 'info'} tone={tone ?? 'emerald'} size="sm" variant="soft" />;

  const body = (
    <View style={[styles.row, !last && styles.divider]}>
      {tile}
      <View style={styles.texts}>
        <AppText variant="caption" color={colors.textMuted}>
          {label}
        </AppText>
        {typeof value === 'string' || typeof value === 'number' ? (
          <AppText variant="bodyStrong" numberOfLines={numberOfLines}>
            {value}
          </AppText>
        ) : (
          value
        )}
      </View>
      {right}
      {onPress && !right && showChevron ? (
        <Icon name="forward" weight="bold" size={16} color={colors.textMuted} />
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: glass.divider,
  },
  texts: { flex: 1 },
  pressed: { opacity: 0.6 },
});

export default InfoRow;
