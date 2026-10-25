import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, curve, fonts, glass, space, squircle, tones } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Avatar } from '../../../ui/Avatar';
import { Chip } from '../../../ui/Chip';
import { SectionCard } from '../../../ui/SectionCard';
import type { Innings } from '../types';
import { BattingTable } from './BattingTable';
import { BowlingTable } from './BowlingTable';
import { ScoreBanner } from './ScoreBanner';

/** "12-1 (A, 2.3 ov), 40-2 (B, 6.1 ov)" -> one entry per wicket (commas inside parentheses kept). */
export function splitFallOfWickets(summary: string | null | undefined): string[] {
  if (!summary || typeof summary !== 'string') return [];
  return summary
    .split(/,(?![^()]*\))/)
    .map(s => s.trim())
    .filter(Boolean);
}

export interface InningsViewProps {
  innings: Innings | null;
  title: string;
}

/** Memoized: an innings that didn't change keeps its object across live updates and skips re-rendering. */
export const InningsView = memo(function InningsView({ innings: teamInnings, title }: InningsViewProps) {
  if (!teamInnings) {
    return null;
  }

  const {
    batting = [],
    bowling = [],
    inning = {},
    extras = { total: 0, summary: '', data: [] },
    fallOfWicket = { summary: '', data: [] },
    partnership = [],
    toBeBat = [],
    teamLogo,
    captain,
  } = teamInnings;

  const fowItems = fallOfWicket.data && fallOfWicket.data.length > 0 ? splitFallOfWickets(fallOfWicket.summary) : [];
  let card = 1;

  return (
    <View style={styles.wrap}>
      {/* Team Header */}
      <View style={styles.teamHeader}>
        <Avatar name={title} uri={typeof teamLogo === 'string' ? teamLogo : undefined} size={46} ring={glass.rim} />
        <View style={styles.teamTitle}>
          <AppText variant="h2" numberOfLines={2}>
            {title}
          </AppText>
          {captain ? (
            <AppText variant="smallStrong" color={colors.textMuted} numberOfLines={1}>
              Captain: {captain.player_name} {captain.is_wicket_keeper ? '(wk)' : ''}
            </AppText>
          ) : null}
        </View>
      </View>

      {/* Team Score */}
      {inning.total_run !== undefined ? (
        <ScoreBanner
          runs={inning.total_run}
          wickets={inning.total_wicket}
          overs={inning.overs_played}
          runRate={inning.summary?.rr}
          extras={extras.total}
        />
      ) : null}

      {/* Batting Stats */}
      {batting.length > 0 ? <BattingTable batting={batting} /> : null}

      {/* Extras Breakdown */}
      {extras.total > 0 ? (
        <SectionCard title={`Extras (${extras.total})`} icon="sparkle" iconTone="amber" tone="butter" animateIndex={card++}>
          <AppText variant="body" color={colors.textSoft}>
            {extras.summary || `Total: ${extras.total}`}
          </AppText>
        </SectionCard>
      ) : null}

      {/* Fall of Wickets */}
      {fallOfWicket.data && fallOfWicket.data.length > 0 ? (
        <SectionCard title="Fall of Wickets" icon="target" iconTone="rose" animateIndex={card++}>
          {fowItems.length > 0 ? (
            <View style={styles.chips}>
              {fowItems.map((item, i) => (
                <Chip key={`${i}-${item}`} label={item} size="sm" tone="coral" style={styles.chip} />
              ))}
            </View>
          ) : (
            <AppText variant="body" color={colors.textSoft}>
              {fallOfWicket.summary}
            </AppText>
          )}
        </SectionCard>
      ) : null}

      {/* Yet to Bat */}
      {toBeBat.length > 0 ? (
        <SectionCard title="Yet to Bat" icon="team" iconTone="sky" animateIndex={card++}>
          <View style={styles.chips}>
            {toBeBat.map((player: any, i: number) => (
              <Chip key={`${i}-${player.name}`} label={player.name} size="sm" tone="neutral" style={styles.chip} />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {/* Bowling Stats */}
      {bowling.length > 0 ? <BowlingTable bowling={bowling} /> : null}

      {/* Partnership Details */}
      {partnership.length > 0 ? (
        <SectionCard title="Partnerships" icon="hands" iconTone="violet" animateIndex={card++}>
          {partnership.map((p: any, index: number) => (
            <View key={index} style={[styles.partnership, index === partnership.length - 1 && styles.partnershipLast]}>
              <View style={[styles.partnershipIndex, curve]}>
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.partnershipIndexRim, curve]} />
                <AppText style={styles.partnershipIndexText} color={tones.emerald.softInk}>
                  {index + 1}
                </AppText>
              </View>
              <AppText variant="small" style={styles.partnershipText}>
                {p.summary || `Partnership ${index + 1}`}
              </AppText>
            </View>
          ))}
        </SectionCard>
      ) : null}
    </View>
  );
});

const INDEX_TILE = 26;

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  teamTitle: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { maxWidth: '100%' },
  partnership: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: glass.divider,
  },
  partnershipLast: { borderBottomWidth: 0 },
  partnershipIndex: {
    width: INDEX_TILE,
    height: INDEX_TILE,
    borderRadius: squircle(INDEX_TILE),
    backgroundColor: tones.emerald.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnershipIndexRim: { borderRadius: squircle(INDEX_TILE), borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  partnershipIndexText: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 17 },
  partnershipText: { flex: 1 },
});

export default InningsView;
