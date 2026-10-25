import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { Ground } from '../../../types/Ground';
import { space } from '../../../theme';
import { BottomSheet } from '../../../ui/BottomSheet';
import { EmptyState } from '../../../ui/EmptyState';
import { SelectableCard } from './SelectableCard';

export interface GroundPickerSheetProps {
  visible: boolean;
  grounds: Ground[];
  selected: Ground | null;
  onSelect: (ground: Ground) => void;
  onClose: () => void;
}

export function GroundPickerSheet({ visible, grounds, selected, onSelect, onClose }: GroundPickerSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Ground" icon="stadium">
      <FlatList
        data={grounds}
        keyExtractor={item => item.ground_id.toString()}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <SelectableCard
            title={item.name}
            lines={[item.address, item.city_name]}
            selected={selected?.ground_id === item.ground_id}
            onPress={() => onSelect(item)}
          />
        )}
        ListEmptyComponent={<EmptyState icon="stadium" title="No grounds available" compact />}
      />
    </BottomSheet>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { paddingBottom: space.sm, paddingTop: space.xxs },
  separator: { height: space.md },
});

export default GroundPickerSheet;
