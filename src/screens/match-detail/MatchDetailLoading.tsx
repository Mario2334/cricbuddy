import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, space, squircle } from '../../theme';
import { AppText } from '../../ui/AppText';
import { BouncingBall } from '../../ui/CricketBall';
import { GlassView } from '../../ui/GlassView';
import { Skeleton } from '../../ui/Skeleton';

const TILE = 32;

/** First-load placeholder under the hero: bouncing ball plus a frosted skeleton card on the mesh. */
export function MatchDetailLoading() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading scorecard">
      <Skeleton height={50} radius={radii.pill} style={styles.tabs} />
      <View style={styles.ball}>
        <BouncingBall size={40} />
        <AppText variant="smallStrong" color={colors.textMuted} style={styles.caption}>
          Loading scorecard...
        </AppText>
      </View>
      <GlassView mode="frost" radius={radii.lg} shadow="glass" style={styles.card}>
        <View style={styles.header}>
          <Skeleton tone="ink" width={TILE} height={TILE} radius={squircle(TILE)} />
          <Skeleton tone="ink" width="45%" height={18} />
        </View>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.row}>
            <Skeleton tone="ink" width={TILE} height={TILE} radius={squircle(TILE)} />
            <View style={styles.col}>
              <Skeleton tone="ink" width="35%" height={10} />
              <Skeleton tone="ink" width="80%" height={14} style={styles.gap} />
            </View>
          </View>
        ))}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.md },
  tabs: { marginBottom: space.md },
  ball: { alignItems: 'center', paddingVertical: space.lg },
  caption: { marginTop: space.sm },
  card: { padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  col: { flex: 1 },
  gap: { marginTop: space.sm },
});

export default MatchDetailLoading;
