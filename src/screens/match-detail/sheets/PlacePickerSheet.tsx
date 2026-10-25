import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { GoogleMapsPlace } from '../../../services/googleMapsService';
import { colors, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { BouncingBall } from '../../../ui/CricketBall';
import { SelectableCard } from './SelectableCard';

export interface PlacePickerSheetProps {
  visible: boolean;
  searching: boolean;
  places: GoogleMapsPlace[];
  selected: GoogleMapsPlace | null;
  onSelect: (place: GoogleMapsPlace) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function PlacePickerSheet({ visible, searching, places, selected, onSelect, onConfirm, onClose }: PlacePickerSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Select Location"
      subtitle="Pick the spot from Google Maps"
      icon="pin"
      iconTone="rose"
      footer={
        selected ? (
          <Button label="Copy to WhatsApp" icon="whatsapp" variant="whatsapp" onPress={onConfirm} fullWidth />
        ) : null
      }
    >
      {searching ? (
        <View style={styles.loading}>
          <BouncingBall size={36} />
          <AppText variant="smallStrong" color={colors.textMuted} style={styles.loadingText}>
            Searching places...
          </AppText>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={item => item.place_id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => (
            <SelectableCard
              title={item.name}
              lines={[item.formatted_address, item.types.join(', ')]}
              selected={selected?.place_id === item.place_id}
              onPress={() => onSelect(item)}
            />
          )}
          ListEmptyComponent={<EmptyState icon="search" title="No places found" compact />}
        />
      )}
    </BottomSheet>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', paddingVertical: space.xxxl },
  loadingText: { marginTop: space.md },
  list: { paddingBottom: space.sm, paddingTop: space.xxs },
  separator: { height: space.md },
});

export default PlacePickerSheet;
