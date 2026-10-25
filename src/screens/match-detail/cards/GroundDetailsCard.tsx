import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Ground } from '../../../types/Ground';
import GroundMapView from '../../../components/GroundMapView';
import { colors, radii, space, squircle } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { InfoRow } from '../../../ui/InfoRow';
import type { IconName } from '../../../ui/icons';
import { SectionCard } from '../../../ui/SectionCard';
import { Skeleton } from '../../../ui/Skeleton';
import { SpinningBall } from '../../../ui/CricketBall';
import { rowTone } from '../styleUtils';

export interface GroundDetailsCardProps {
  ground: Ground;
  animateIndex?: number;
}

export function GroundDetailsCard({ ground, animateIndex }: GroundDetailsCardProps) {
  const pricing = [ground.day_price && `Day: ${ground.day_price}`, ground.night_price && `Night: ${ground.night_price}`]
    .filter(Boolean)
    .join(' | ');

  const rows: Array<{ key: string; icon: IconName; label: string; value: string | number }> = [
    { key: 'name', icon: 'pin', label: 'Ground Name', value: ground.name },
    { key: 'city', icon: 'city', label: 'City', value: ground.city_name },
  ];
  if (ground.address) rows.push({ key: 'address', icon: 'address', label: 'Address', value: ground.address });
  if (ground.primary_mobile) rows.push({ key: 'contact', icon: 'phone', label: 'Contact', value: ground.primary_mobile });
  rows.push({ key: 'views', icon: 'views', label: 'Total Views', value: ground.total_views });
  if (ground.rating > 0) rows.push({ key: 'rating', icon: 'star', label: 'Rating', value: `${ground.rating}/5` });
  if (ground.day_price || ground.night_price) rows.push({ key: 'pricing', icon: 'money', label: 'Pricing', value: pricing });
  if (ground.slot_booking_ball_type) {
    rows.push({ key: 'balls', icon: 'ball', label: 'Ball Types', value: ground.slot_booking_ball_type });
  }
  rows.push({
    key: 'booking',
    icon: 'checkCircle',
    label: 'Available for Booking',
    value: ground.is_available_for_booking ? 'Yes' : 'No',
  });

  return (
    <SectionCard title="Ground Details" icon="map" iconTone="teal" animateIndex={animateIndex}>
      <View style={styles.map}>
        <GroundMapView ground={ground} showSearchButton={true} />
      </View>
      {rows.map((row, i) => (
        <InfoRow
          key={row.key}
          icon={row.icon}
          label={row.label}
          value={row.value}
          numberOfLines={3}
          tone={rowTone(i)}
          last={i === rows.length - 1}
        />
      ))}
    </SectionCard>
  );
}

/** Placeholder while the ground detail request is in flight. */
export function GroundDetailsLoadingCard({ animateIndex }: { animateIndex?: number }) {
  return (
    <SectionCard title="Ground Details" icon="map" iconTone="teal" animateIndex={animateIndex}>
      <Skeleton tone="ink" height={160} radius={radii.lg} />
      <View style={styles.skeletonRow}>
        <Skeleton tone="ink" width={32} height={32} radius={squircle(32)} />
        <View style={styles.skeletonCol}>
          <Skeleton tone="ink" width="30%" height={10} />
          <Skeleton tone="ink" width="70%" height={14} style={styles.skeletonGap} />
        </View>
      </View>
      <View style={styles.loadingRow}>
        <SpinningBall size={20} />
        <AppText variant="smallStrong" color={colors.textMuted} style={styles.loadingText}>
          Loading ground details...
        </AppText>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  map: { marginBottom: space.sm },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  skeletonCol: { flex: 1 },
  skeletonGap: { marginTop: space.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  loadingText: { marginLeft: space.sm },
});

export default GroundDetailsCard;
