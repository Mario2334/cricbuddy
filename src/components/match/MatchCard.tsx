import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Match } from '../../types/Match';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, glass, gradients, palette, radii } from '../../theme';
import { statusDateLabel } from '../../utils/dates';
import { getMatchStart, getTeamNames, normalizeStatus, scoreLine } from '../../utils/matchDisplay';
import { AppText } from '../../ui/AppText';
import { Avatar } from '../../ui/Avatar';
import { Icon } from '../../ui/Icon';
import { IconTile } from '../../ui/IconTile';
import { DateBadge } from '../../ui/DateBadge';
import { PlayCard } from '../../ui/PlayCard';
import { StatusDateChip } from '../../ui/StatusDateChip';
import { MAX_STAGGERED_ITEMS, STAGGER_MS } from '../../theme/motion';

export interface MatchCardProps {
  match: Match;
  now: Date;
  onPress: (m: Match) => void;
  index?: number;
  /** Play the staggered entrance (first render only). */
  animateIn?: boolean;
  variant?: 'full' | 'compact';
  right?: React.ReactNode;
  testID?: string;
}

function TeamRow({ name, score, winner }: { name: string; score: string | null; winner: boolean }) {
  return (
    <View style={styles.teamRow}>
      <Avatar name={name} size={26} />
      <AppText
        variant="title"
        numberOfLines={1}
        style={styles.teamName}
        color={winner ? colors.primaryStrong : colors.text}
      >
        {name}
      </AppText>
      {winner ? <Icon name="trophy" size={15} weight="fill" color={palette.amber500} style={styles.winIcon} /> : null}
      {score ? (
        <AppText style={styles.score} color={colors.text} numberOfLines={1}>
          {score}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * The one match card used across Home, My Team and Calendar: tear-off date
 * badge, teams with avatars, status + date chip, and a result banner.
 */
function MatchCardBase({ match, now, onPress, index = 0, animateIn = false, variant = 'full', right, testID }: MatchCardProps) {
  const status = normalizeStatus(match.status);
  const start = getMatchStart(match);
  const { team1, team2 } = getTeamNames(match);
  const s1 = scoreLine(match.team1_score);
  const s2 = scoreLine(match.team2_score);
  const showScores = (status === 'live' || status === 'past') && !!(s1 || s2);
  const winner = (match.winning_team || '').trim().toLowerCase();
  const info = statusDateLabel(status, start, now);
  const round = match.round_name || match.tournament_round_name;
  const format = match.match_format || match.match_type;
  const compact = variant === 'compact';
  const badgeDelay = animateIn ? Math.min(index, MAX_STAGGERED_ITEMS) * STAGGER_MS + 160 : 0;

  return (
    <PlayCard
      tone={status === 'live' ? 'live' : 'default'}
      onPress={() => onPress(match)}
      animateIndex={animateIn ? index : undefined}
      accessibilityLabel={`${team1} versus ${team2}. ${info.text}`}
      style={styles.card}
      testID={testID}
    >
      <View style={styles.row}>
        <DateBadge date={start} now={now} status={status} size={compact ? 'sm' : 'md'} delay={badgeDelay} />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <AppText variant="overline" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
              {match.tournament_name || 'Practice Match'}
            </AppText>
            {right}
          </View>
          {!compact && round ? (
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
              {round}
            </AppText>
          ) : null}

          {compact ? (
            <AppText variant="title" numberOfLines={1} style={styles.compactTeams}>
              {team1} <AppText variant="title" color={palette.lime600}>vs</AppText> {team2}
            </AppText>
          ) : (
            <View style={styles.teams}>
              <TeamRow name={team1} score={showScores ? s1 : null} winner={status === 'past' && !!winner && winner === team1.trim().toLowerCase()} />
              <View style={styles.vsRow}>
                <View style={styles.vsLine} />
                <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.vsBubble}>
                  <AppText style={styles.vsText} color={colors.onAccent}>
                    VS
                  </AppText>
                </LinearGradient>
                <View style={styles.vsLine} />
              </View>
              <TeamRow name={team2} score={showScores ? s2 : null} winner={status === 'past' && !!winner && winner === team2.trim().toLowerCase()} />
            </View>
          )}

          <View style={styles.meta}>
            <StatusDateChip status={status} start={start} now={now} size="sm" />
          </View>
          {(!compact && format) || match.ground_name ? (
            <View style={styles.footRow}>
              {!compact && format ? (
                <View style={styles.formatPill}>
                  <AppText variant="caption" color={palette.inkSoft} numberOfLines={1}>
                    {format}
                  </AppText>
                </View>
              ) : null}
              {match.ground_name ? (
                <View style={styles.groundRow}>
                  <Icon name="pin" size={13} weight="fill" color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
                    {match.ground_name}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {!compact && status === 'past' && match.match_result ? (
        <View style={styles.result}>
          <IconTile icon="trophy" tone="amber" size="xs" />
          <AppText variant="smallStrong" color="#92400E" numberOfLines={2} style={styles.flex}>
            {match.match_result}
          </AppText>
        </View>
      ) : null}
    </PlayCard>
  );
}

export const MatchCard = memo(MatchCardBase);

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  body: { flex: 1, marginLeft: 12 },
  flex: { flex: 1 },
  topLine: { flexDirection: 'row', alignItems: 'center' },
  teams: { marginTop: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center' },
  teamName: { flex: 1, marginLeft: 8 },
  score: { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 22, marginLeft: 8, fontVariant: ['tabular-nums'] },
  vsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, paddingLeft: 4 },
  vsLine: { flex: 1, height: 1, backgroundColor: glass.divider },
  vsBubble: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginHorizontal: 6,
  },
  vsText: { fontFamily: fonts.displayBold, fontSize: 10, lineHeight: 13 },
  compactTeams: { marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  formatPill: {
    backgroundColor: glass.fill,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groundRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  winIcon: { marginLeft: 4 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  result: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(254,243,199,0.7)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.9)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
});

export default MatchCard;
