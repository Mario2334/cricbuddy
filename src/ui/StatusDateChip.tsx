import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, glass, palette, radii, statusColors } from '../theme';
import { statusDateLabel, toDate, type DateInput, type MatchStatus } from '../utils/dates';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PulseDot } from './PulseDot';

export interface StatusDateChipProps {
  status: MatchStatus;
  start?: DateInput;
  now: Date;
  size?: 'sm' | 'md';
  variant?: 'soft' | 'onDark';
  style?: StyleProp<ViewStyle>;
}

/** "Upcoming · Tomorrow 7:00 AM", "LIVE · started 1h ago", "Done · Sat 24 Oct". */
export function StatusDateChip({ status, start, now, size = 'md', variant = 'soft', style }: StatusDateChipProps) {
  const c = statusColors[status];
  const info = statusDateLabel(status, toDate(start), now);
  const onDark = variant === 'onDark';
  const small = size === 'sm';
  const fg = onDark ? palette.white : c.fg;

  return (
    <View
      accessible
      accessibilityLabel={info.text}
      style={[
        styles.chip,
        {
          backgroundColor: onDark ? glass.fillDark : c.bg,
          borderColor: onDark ? glass.rimDark : c.border,
          paddingVertical: small ? 3 : 5,
          paddingHorizontal: small ? 8 : 10,
        },
        style,
      ]}
    >
      {status === 'past' ? (
        <Icon name="checkCircle" weight="fill" size={small ? 13 : 15} color={onDark ? palette.white : c.dot} />
      ) : (
        <PulseDot color={onDark && status !== 'live' ? palette.yellow300 : c.dot} size={small ? 7 : 8} pulsing={status === 'live'} />
      )}
      <AppText
        style={{ fontFamily: fonts.bodyBlack, fontSize: small ? 11 : 12, lineHeight: small ? 14 : 16, marginLeft: 6 }}
        color={fg}
      >
        {info.label}
      </AppText>
      <AppText
        style={{ fontFamily: fonts.bodyBold, fontSize: small ? 11 : 12, lineHeight: small ? 14 : 16 }}
        color={fg}
        numberOfLines={1}
      >
        {' · '}
        {info.detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexShrink: 1,
  },
});

export default StatusDateChip;
