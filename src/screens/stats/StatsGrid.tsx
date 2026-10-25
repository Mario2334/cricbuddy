import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { colors } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { StatTileSkeleton } from '../../ui/Skeleton';
import { useTabBarSpace } from '../../navigation/useTabBarSpace';
import { StatTile } from './StatTile';
import { KIND_EMPTY, type StatItem, type StatKind } from './statMeta';

export interface StatsGridProps {
  stats?: StatItem[];
  kind: StatKind;
  refreshing: boolean;
  onRefresh: () => void;
}

/** One tab's worth of stat tiles in a two-column grid. */
export function StatsGrid({ stats, kind, refreshing, onRefresh }: StatsGridProps) {
  const isFocused = useIsFocused();
  // Count up the first time the tab is shown, not on every revisit.
  const [played, setPlayed] = useState(isFocused);
  useEffect(() => {
    if (isFocused) setPlayed(true);
  }, [isFocused]);
  const bottomSpace = useTabBarSpace();
  const list = stats ?? [];
  const hasStats = list.length > 0;
  const empty = KIND_EMPTY[kind];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }, !hasStats && styles.contentEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {hasStats ? (
        <View style={styles.grid}>
          {list.map((stat, i) => (
            <StatTile
              key={`${stat.title}-${i}`}
              stat={stat}
              index={i}
              kind={kind}
              play={played}
              style={styles.cell}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon={empty.icon} tone={empty.tone} title={empty.title} message={empty.message} />
      )}
    </ScrollView>
  );
}

/** Placeholder grid shown while stats load (also used as the lazy-tab placeholder). */
export function StatsGridSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeleton}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.skeletonRow}>
          <StatTileSkeleton />
          <StatTileSkeleton />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 6 },
  contentEmpty: { flexGrow: 1, justifyContent: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: { width: '48%', marginBottom: 14 },
  skeleton: { paddingHorizontal: 10, paddingTop: 6 },
  skeletonRow: { flexDirection: 'row' },
});

export default StatsGrid;
