import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Chip } from '../../../ui/Chip';
import { SectionCard } from '../../../ui/SectionCard';
import { Skeleton } from '../../../ui/Skeleton';
import type { AiReport, AnalysisFacts, MatchLine } from '../types';
import { formatInt, formatRate, resultLetter, resultTone } from '../utils/format';
import { MiniStat, MiniStatRow } from './MiniStat';

export interface OppositionCardProps {
  facts: AnalysisFacts;
  ai: AiReport['opposition'] | null;
  /** The model is still writing; show placeholders where its prose goes. */
  pending: boolean;
  animateIndex?: number;
}

const lineText = (l: MatchLine): string => {
  const verb = l.result === 'won' ? 'beat' : l.result === 'lost' ? 'lost to' : l.result === 'tie' ? 'tied with' : 'no result v';
  return `${l.date.slice(5)} · ${verb} ${l.opponent}${l.margin && l.result !== 'nr' ? ` by ${l.margin}` : ''}`;
};

/** The opposition's recent form from the facts, plus the model's read of threats and weaknesses. */
export function OppositionCard({ facts, ai, pending, animateIndex }: OppositionCardProps) {
  const opp = facts.opposition;
  const h2h = facts.our_team.vs_opponent;
  const h2hWins = h2h.filter(l => l.result === 'won').length;
  const h2hLosses = h2h.filter(l => l.result === 'lost').length;
  const subtitle = opp.totals ? `Won ${opp.totals.won} of ${opp.totals.matches} (${opp.totals.win_pct}) · bat first ${opp.totals.bat_first}×` : `Last ${opp.last5.length} matches`;

  return (
    <SectionCard title={`vs ${opp.name}`} icon="target" iconTone="rose" subtitle={subtitle} animateIndex={animateIndex}>
      <View style={styles.strip}>
        {opp.last5.map(l => (
          <Chip key={l.match_id} size="sm" label={resultLetter(l.result)} tone={resultTone(l.result)} selected={l.result !== 'nr'} haptic={false} />
        ))}
        {opp.captain ? (
          <AppText variant="caption" color={colors.textSoft} style={styles.captain}>
            {`Captain ${opp.captain}${opp.keeper ? ` · keeper ${opp.keeper}` : ''}`}
          </AppText>
        ) : null}
      </View>
      {opp.last5.map(l => (
        <AppText key={l.match_id} variant="small" color={colors.textSoft}>
          {lineText(l)}
        </AppText>
      ))}

      <MiniStatRow>
        <MiniStat label="Avg batting 1st" value={formatInt(opp.aggregates.avg_bat_first)} hint={`${opp.aggregates.wins_bat_first} win${opp.aggregates.wins_bat_first === 1 ? '' : 's'}`} />
        <MiniStat label="Avg chasing" value={formatInt(opp.aggregates.avg_chasing)} hint={`${opp.aggregates.wins_chasing} win${opp.aggregates.wins_chasing === 1 ? '' : 's'}`} />
        <MiniStat label="Wkts lost / inns" value={formatRate(opp.aggregates.avg_wkts_lost)} />
      </MiniStatRow>

      {h2h.length ? (
        <View style={styles.block}>
          <AppText variant="caption" color={colors.textSoft}>{`HEAD TO HEAD · ${h2hWins}W ${h2hLosses}L`}</AppText>
          {h2h.slice(0, 3).map(l => (
            <AppText key={l.match_id} variant="small" color={colors.textSoft}>
              {`${l.date.slice(5)} · ${l.result === 'won' ? 'we won' : l.result === 'lost' ? 'we lost' : l.result} ${l.margin ? `by ${l.margin}` : ''} · ${l.our_score} v ${l.their_score}`}
            </AppText>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <AppText variant="caption" color={colors.textSoft}>
          THEIR TOP BATTERS
        </AppText>
        {opp.batters.slice(0, 3).map(b => (
          <AppText key={b.player_id} variant="small">
            {`${b.name} · ${b.batting.runs} runs in ${b.batting.inns} inns · SR ${formatRate(b.batting.sr)}`}
          </AppText>
        ))}
        <AppText variant="caption" color={colors.textSoft} style={styles.gapTop}>
          THEIR TOP BOWLERS
        </AppText>
        {opp.bowlers.slice(0, 3).map(b => (
          <AppText key={b.player_id} variant="small">
            {`${b.name} · ${b.bowling.wkts} wkts in ${b.bowling.inns} spells · econ ${formatRate(b.bowling.econ, 2)}`}
          </AppText>
        ))}
      </View>

      {ai ? (
        <View style={styles.block}>
          <AppText variant="body">{ai.summary}</AppText>
          {ai.likely_approach ? (
            <AppText variant="small" color={colors.textSoft} style={styles.gapTop}>
              {ai.likely_approach}
            </AppText>
          ) : null}
          {ai.key_threats.length ? (
            <AppText variant="caption" color={colors.textSoft} style={styles.gapTop}>
              KEY THREATS
            </AppText>
          ) : null}
          {ai.key_threats.map((t, i) => (
            <AppText key={`${t.player_id ?? t.name}-${i}`} variant="small" style={styles.item}>
              <AppText variant="smallStrong">{t.name}</AppText>
              {` · ${t.why}`}
            </AppText>
          ))}
          {ai.weaknesses.length ? (
            <AppText variant="caption" color={colors.textSoft} style={styles.gapTop}>
              WHERE TO ATTACK
            </AppText>
          ) : null}
          {ai.weaknesses.map((w, i) => (
            <AppText key={i} variant="small" style={styles.item}>
              {`• ${w}`}
            </AppText>
          ))}
        </View>
      ) : pending ? (
        <View style={styles.block}>
          <Skeleton height={16} />
          <Skeleton height={16} width="85%" style={styles.gapTop} />
          <Skeleton height={16} width="60%" style={styles.gapTop} />
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm, flexWrap: 'wrap' },
  captain: { marginLeft: space.xs },
  block: { marginTop: space.md },
  gapTop: { marginTop: space.sm },
  item: { marginTop: 4 },
});

export default OppositionCard;
