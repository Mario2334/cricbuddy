import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Button } from '../../../ui/Button';
import { Chip } from '../../../ui/Chip';
import { EmptyState } from '../../../ui/EmptyState';
import { InfoRow } from '../../../ui/InfoRow';
import { SectionCard } from '../../../ui/SectionCard';
import { Skeleton } from '../../../ui/Skeleton';
import type { AnalyticsError } from '../services/analyticsApiClient';
import type { AvailabilityCounts } from '../hooks/useAvailability';
import type { AvailabilityStatus, RosterPlayer, SquadGaps } from '../types';
import { roleLabel, severityTone } from '../utils/format';
import { PlayerRow } from './PlayerRow';

export interface AvailabilityCardProps {
  players: RosterPlayer[];
  entries: Map<number, AvailabilityStatus>;
  counts: AvailabilityCounts;
  gaps: SquadGaps | null;
  known: boolean;
  loading: boolean;
  saving: boolean;
  error: AnalyticsError | null;
  showAll: boolean;
  onCycle: (playerId: number) => void;
  onToggleShowAll: () => void;
  onRetry: () => void;
  animateIndex?: number;
}

const STATUS_CHIP: Record<AvailabilityStatus, { label: string; tone: 'green' | 'yellow' | 'coral' | 'neutral'; selected: boolean }> = {
  yes: { label: 'Yes', tone: 'green', selected: true },
  maybe: { label: 'Maybe', tone: 'yellow', selected: true },
  no: { label: 'No', tone: 'coral', selected: true },
  unknown: { label: 'Tap to mark', tone: 'neutral', selected: false },
};

const ORDER: Record<AvailabilityStatus, number> = { yes: 0, maybe: 1, unknown: 2, no: 3 };
/** Unmarked players beyond this many rows are folded behind "Show more" (marked ones always show). */
const VISIBLE_UNMARKED = 12;

function describe(p: RosterPlayer): string {
  const bits = [roleLabel(p.role)];
  if (p.can_keep && p.role !== 'wicket-keeper') bits.push('can keep');
  if (p.part_time_bowler) bits.push('part-time bowler');
  const apps = p.agg?.appearances ?? 0;
  if (apps) bits.push(`${apps} recent ${apps === 1 ? 'match' : 'matches'}`);
  return bits.join(' · ');
}

/** Tap a player to cycle yes → maybe → no; the squad-gap check updates with every save. */
export function AvailabilityCard({ players, entries, counts, gaps, known, loading, saving, error, showAll, onCycle, onToggleShowAll, onRetry, animateIndex }: AvailabilityCardProps) {
  const subtitle = known ? `${counts.yes} yes · ${counts.maybe} maybe · ${counts.no} no` : 'Tap a player to mark yes, maybe or no';
  const [expanded, setExpanded] = useState(false);
  const sorted = [...players].sort((a, b) => {
    const d = ORDER[entries.get(a.player_id) ?? 'unknown'] - ORDER[entries.get(b.player_id) ?? 'unknown'];
    return d || (b.agg?.appearances ?? 0) - (a.agg?.appearances ?? 0) || a.name.localeCompare(b.name);
  });
  let unmarkedShown = 0;
  const visible = expanded
    ? sorted
    : sorted.filter(p => {
        if ((entries.get(p.player_id) ?? 'unknown') !== 'unknown') return true;
        unmarkedShown += 1;
        return unmarkedShown <= VISIBLE_UNMARKED;
      });
  const hidden = sorted.length - visible.length;

  let body: React.ReactNode;
  if (loading && !players.length) {
    body = (
      <View style={styles.skeletons}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} height={44} />
        ))}
      </View>
    );
  } else if (error && !players.length) {
    body = <EmptyState compact tone="error" icon="warning" title="Couldn't load the squad" message={error.message} actionLabel="Retry" onAction={onRetry} />;
  } else {
    body = (
      <>
        {visible.map((p, i) => {
          const status = entries.get(p.player_id) ?? 'unknown';
          const chip = STATUS_CHIP[status];
          return (
            <PlayerRow
              key={p.player_id}
              name={p.name}
              photo={p.photo}
              subtitle={describe(p)}
              dim={status === 'no'}
              last={i === visible.length - 1}
              onPress={() => onCycle(p.player_id)}
              right={<Chip size="sm" label={chip.label} tone={chip.tone} selected={chip.selected} onPress={() => onCycle(p.player_id)} />}
              testID={`availability-${p.player_id}`}
            />
          );
        })}
        {hidden > 0 || expanded ? (
          <View style={styles.more}>
            <Button
              label={expanded ? 'Show fewer' : `Show ${hidden} more ${hidden === 1 ? 'player' : 'players'}`}
              variant="ghost"
              size="sm"
              icon={expanded ? 'chevronUp' : 'chevronDown'}
              onPress={() => setExpanded(v => !v)}
            />
          </View>
        ) : null}
        <View style={styles.gaps}>
          {known && gaps ? (
            gaps.issues.length ? (
              gaps.issues.map((issue, i) => (
                <InfoRow
                  key={issue.code}
                  icon="warning"
                  tone={severityTone(issue.severity) === 'coral' ? 'rose' : severityTone(issue.severity) === 'yellow' ? 'amber' : 'slate'}
                  label={issue.message}
                  last={i === gaps.issues.length - 1}
                />
              ))
            ) : (
              <InfoRow icon="checkCircle" tone="emerald" label="Squad looks balanced" value={`${gaps.bowling_options} bowling options · ${gaps.counts.keepers} keeper${gaps.counts.keepers === 1 ? '' : 's'} · ${gaps.yes} confirmed`} last />
            )
          ) : (
            <AppText variant="small" color={colors.textSoft}>
              Once you mark who can play, this shows if the squad is short of bowlers, a keeper or players.
            </AppText>
          )}
        </View>
        <View style={styles.footer}>
          <Button label={showAll ? 'Show regulars only' : 'Show all team members'} variant="ghost" size="sm" icon="team" onPress={onToggleShowAll} />
        </View>
      </>
    );
  }

  return (
    <SectionCard
      title="Availability"
      icon="team"
      iconTone="emerald"
      subtitle={subtitle}
      right={
        saving ? (
          <AppText variant="caption" color={colors.textSoft}>
            Saving…
          </AppText>
        ) : undefined
      }
      animateIndex={animateIndex}
    >
      {body}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  skeletons: { gap: space.sm },
  more: { marginTop: space.xs, alignItems: 'flex-start' },
  gaps: { marginTop: space.md },
  footer: { marginTop: space.sm, alignItems: 'flex-start' },
});

export default AvailabilityCard;
