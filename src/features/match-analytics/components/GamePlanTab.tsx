import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNow } from '../../../hooks/useNow';
import { colors, space } from '../../../theme';
import { EmptyState } from '../../../ui/EmptyState';
import { useAvailability } from '../hooks/useAvailability';
import { useMatchAnalysis } from '../hooks/useMatchAnalysis';
import type { AnalysisPostBody, GamePlanMatch } from '../types';
import { AnalysisStatusCard } from './AnalysisStatusCard';
import { AvailabilityCard } from './AvailabilityCard';
import { BattingOrderCard } from './BattingOrderCard';
import { BestXIICard } from './BestXIICard';
import { BowlingPlanCard } from './BowlingPlanCard';
import { GroundPitchCard } from './GroundPitchCard';
import { OppositionCard } from './OppositionCard';

export interface GamePlanTabProps {
  match: GamePlanMatch;
}

/** The "Game plan" tab of MatchDetail: availability, the AI plan's status, then the plan's cards. */
export function GamePlanTab({ match }: GamePlanTabProps) {
  const insets = useSafeAreaInsets();
  const hint = useMemo<AnalysisPostBody['hint']>(
    () =>
      match.opponentTeamId
        ? { team_a_id: match.ourTeamId, team_b_id: match.opponentTeamId, ground_id: match.groundId, overs: match.overs, match_start_time: match.startTime }
        : undefined,
    [match],
  );
  const analysis = useMatchAnalysis(match.matchId, { hint });
  const availability = useAvailability(match.matchId, { onSaved: () => void analysis.reload() });
  const now = useNow(1000, { enabled: analysis.active });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([availability.reload(), analysis.reload()]);
    } finally {
      setRefreshing(false);
    }
  }, [availability, analysis]);

  const facts = analysis.report?.facts ?? analysis.job?.facts ?? null;
  const ai = analysis.report?.ai ?? null;
  const pool = facts?.pool ?? [];
  const unreachable = availability.error?.kind === 'unreachable' && !availability.players.length && (!analysis.job || analysis.error?.kind === 'unreachable');
  let i = 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      showsVerticalScrollIndicator
    >
      {unreachable ? (
        <View style={styles.empty}>
          <EmptyState icon="warning" tone="error" title="Can't reach the CricBuddy server" message="The game plan lives on the Veyden server, which is only reachable over Tailscale. Turn Tailscale on and try again." actionLabel="Retry" onAction={() => void onRefresh()} />
        </View>
      ) : (
        <>
          <AvailabilityCard
            players={availability.players}
            entries={availability.entries}
            counts={availability.counts}
            gaps={availability.gaps}
            known={availability.known}
            loading={availability.loading}
            saving={availability.saving}
            error={availability.error}
            showAll={availability.showAll}
            onCycle={availability.cycleStatus}
            onToggleShowAll={availability.toggleShowAll}
            onRetry={() => void availability.reload()}
            animateIndex={i++}
          />
          <AnalysisStatusCard
            job={analysis.job}
            report={analysis.report}
            stale={analysis.stale}
            active={analysis.active}
            requesting={analysis.requesting}
            capReached={analysis.capReached}
            error={analysis.error}
            now={now}
            onRequest={() => void analysis.request()}
            animateIndex={i++}
          />
          {facts ? <OppositionCard facts={facts} ai={ai?.opposition ?? null} pending={analysis.active} animateIndex={i++} /> : null}
          {ai || analysis.active ? <BestXIICard ai={ai} pool={pool} animateIndex={i++} /> : null}
          {ai ? <BattingOrderCard ai={ai} pool={pool} animateIndex={i++} /> : null}
          {ai ? <BowlingPlanCard ai={ai} pool={pool} animateIndex={i++} /> : null}
          {facts ? <GroundPitchCard facts={facts} ai={ai?.ground_pitch ?? null} tossCall={ai?.toss_call ?? null} pending={analysis.active} animateIndex={i++} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.lg },
  empty: { paddingTop: space.xl },
});

export default GamePlanTab;
