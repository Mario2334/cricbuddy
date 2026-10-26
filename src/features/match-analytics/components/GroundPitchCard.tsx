import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Chip } from '../../../ui/Chip';
import { SectionCard } from '../../../ui/SectionCard';
import { Skeleton } from '../../../ui/Skeleton';
import type { AiReport, AnalysisFacts } from '../types';
import { formatInt, formatRate } from '../utils/format';
import { MiniStat, MiniStatRow } from './MiniStat';

export interface GroundPitchCardProps {
  facts: AnalysisFacts;
  ai: AiReport['ground_pitch'] | null;
  tossCall: string | null;
  pending: boolean;
  animateIndex?: number;
}

const CALL: Record<'bat' | 'chase' | 'either', string> = { bat: 'Bat first', chase: 'Chase', either: 'Either way' };

/** Ground facts from the last matches played there, then the model's bat/chase call. */
export function GroundPitchCard({ facts, ai, tossCall, pending, animateIndex }: GroundPitchCardProps) {
  const info = facts.ground_info;
  const g = facts.ground;
  const bits: string[] = [];
  if (info?.pitch_types.length) bits.push(info.pitch_types.join(', '));
  if (info?.shortest_boundary && info.longest_boundary) bits.push(`boundaries ${info.shortest_boundary}–${info.longest_boundary} m`);
  else if (info?.longest_boundary) bits.push(`boundary ${info.longest_boundary} m`);
  if (info?.ground_type) bits.push(info.ground_type);
  const subtitle = bits.length ? bits.join(' · ') : 'No pitch details on CricHeroes';

  return (
    <SectionCard title={info?.name || facts.match.ground_name || 'Ground'} icon="stadium" iconTone="sky" subtitle={subtitle} animateIndex={animateIndex}>
      {g && g.sample ? (
        <>
          <MiniStatRow>
            <MiniStat label="Avg 1st inns" value={formatInt(g.aggregates.avg_first_inns)} hint={`${formatRate(g.aggregates.avg_wkts_first_inns)} wkts`} />
            <MiniStat label="Avg 2nd inns" value={formatInt(g.aggregates.avg_second_inns)} />
            <MiniStat label="Bat 1st / chase" value={`${g.aggregates.bat_first_wins} / ${g.aggregates.chase_wins}`} hint="wins" />
          </MiniStatRow>
          <AppText variant="caption" color={colors.textSoft} style={styles.block}>
            {`LAST ${g.sample} HERE${g.our_record.played ? ` · OURS ${g.our_record.won}W ${g.our_record.lost}L` : ''}`}
          </AppText>
          {g.matches.map(m => (
            <AppText key={m.match_id} variant="small" color={colors.textSoft}>
              {`${m.date.slice(5)} · ${m.team_a} ${m.first_inns} v ${m.team_b} ${m.second_inns}${m.winner ? ` · ${m.winner} won${m.chased ? ' chasing' : ''}` : ''}`}
            </AppText>
          ))}
        </>
      ) : (
        <AppText variant="small" color={colors.textSoft}>
          No recent matches at this ground in either team's history.
        </AppText>
      )}

      {ai ? (
        <View style={styles.block}>
          <View style={styles.callRow}>
            <Chip label={CALL[ai.bat_first_or_chase]} tone="green" selected haptic={false} icon="toss" />
            {ai.par_score ? (
              <AppText variant="smallStrong" color={colors.textSoft}>{`Par about ${ai.par_score}`}</AppText>
            ) : null}
          </View>
          <AppText variant="body" style={styles.gapTop}>
            {ai.summary}
          </AppText>
          {ai.why ? (
            <AppText variant="small" color={colors.textSoft} style={styles.gapTop}>
              {ai.why}
            </AppText>
          ) : null}
          {tossCall ? (
            <AppText variant="small" style={styles.gapTop}>
              <AppText variant="smallStrong">Toss: </AppText>
              {tossCall}
            </AppText>
          ) : null}
        </View>
      ) : pending ? (
        <View style={styles.block}>
          <Skeleton height={16} />
          <Skeleton height={16} width="70%" style={styles.gapTop} />
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: space.md },
  gapTop: { marginTop: space.sm },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

export default GroundPitchCard;
