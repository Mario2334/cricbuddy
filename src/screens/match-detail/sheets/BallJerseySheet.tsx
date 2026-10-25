import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, palette, space } from '../../../theme';
import { BottomSheet } from '../../../ui/BottomSheet';
import { SelectableCard } from './SelectableCard';

export interface BallJerseySheetProps {
  visible: boolean;
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
  onClose: () => void;
}

/** Little ball swatch: red leather for red-ball options, white otherwise. */
function BallSwatch({ option }: { option: string }) {
  const red = /red ball/i.test(option);
  return <View style={[styles.swatch, red ? styles.swatchRed : styles.swatchWhite]} />;
}

export function BallJerseySheet({ visible, options, selected, onSelect, onClose }: BallJerseySheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Ball & Jersey" icon="jersey" iconTone="amber">
      <View style={styles.list}>
        {options.map(item => (
          <SelectableCard
            key={item}
            title={item}
            selected={selected === item}
            onPress={() => onSelect(item)}
            leading={<BallSwatch option={item} />}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, paddingTop: space.xxs, paddingBottom: space.sm },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5 },
  swatchRed: { backgroundColor: palette.rose600, borderColor: palette.coral400 },
  swatchWhite: { backgroundColor: palette.white, borderColor: colors.borderStrong },
});

export default BallJerseySheet;
