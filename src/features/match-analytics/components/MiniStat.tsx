import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, glass, radii, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';

export interface MiniStatProps {
  label: string;
  value: string;
  hint?: string;
}

/** A small frosted number tile; lay several in a row. */
export function MiniStat({ label, value, hint }: MiniStatProps) {
  return (
    <View style={styles.tile}>
      <AppText variant="title" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textSoft} numberOfLines={1}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" color={colors.textSoft} numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function MiniStatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  tile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.rim,
  },
});

export default MiniStat;
