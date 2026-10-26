import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { SectionCard } from '../../../ui/SectionCard';
import type { AiReport, PoolPlayer } from '../types';
import { formatRate, phaseLabel } from '../utils/format';
import { PlayerRow } from './PlayerRow';

export interface BowlingPlanCardProps {
  ai: AiReport;
  pool: PoolPlayer[];
  animateIndex?: number;
}

export function BowlingPlanCard({ ai, pool, animateIndex }: BowlingPlanCardProps) {
  const byId = new Map(pool.map(p => [p.player_id, p]));
  const plan = ai.bowling_plan;
  return (
    <SectionCard title="Bowling plan" icon="ball" iconTone="teal" subtitle={`${plan.overs_total} overs across ${plan.bowlers.length} bowlers`} animateIndex={animateIndex}>
      {plan.bowlers.map((b, i) => {
        const agg = byId.get(b.player_id)?.agg?.bowling;
        return (
          <PlayerRow
            key={b.player_id}
            name={b.name}
            photo={byId.get(b.player_id)?.photo}
            subtitle={`${b.phases.map(phaseLabel).join(' · ')}${agg && agg.inns ? ` · ${agg.wkts} wkts, econ ${formatRate(agg.econ, 2)}` : ''}`}
            note={b.why}
            right={
              <AppText variant="title" color={colors.primaryStrong}>
                {`${b.overs} ov`}
              </AppText>
            }
            last={i === plan.bowlers.length - 1}
          />
        );
      })}
      {plan.notes ? (
        <View style={styles.notes}>
          <AppText variant="small" color={colors.textSoft}>
            {plan.notes}
          </AppText>
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  notes: { marginTop: space.md },
});

export default BowlingPlanCard;
