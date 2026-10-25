import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import type { Match } from '../../types/Match';
import { colors, glass, palette, radii } from '../../theme';
import { formatShortDate, isSameLocalDay, relativeDayLabel } from '../../utils/dates';
import { getMatchStart, matchKey, sortByStart } from '../../utils/matchDisplay';
import { AppText } from '../../ui/AppText';
import { Button } from '../../ui/Button';
import { IconTile } from '../../ui/IconTile';
import { MatchCard } from '../match/MatchCard';
import { SwipeableMatchRow } from './SwipeableMatchRow';

interface AgendaListProps {
  selectedDate: Date;
  now: Date;
  matches: Match[];
  onMatchPress: (m: Match) => void;
  onRemoveMatch?: (m: Match) => void;
  onAddForDate?: (d: Date) => void;
}

/** The selected day's matches, then the next few coming up. */
export function AgendaList({ selectedDate, now, matches, onMatchPress, onRemoveMatch, onAddForDate }: AgendaListProps) {
  const reduced = useReducedMotion();
  // Rows stagger in the first time they appear, not on every day tap.
  const animated = useRef(new Set<string>());

  const dayMatches = useMemo(
    () =>
      sortByStart(
        matches.filter(m => {
          const s = getMatchStart(m);
          return !!s && isSameLocalDay(s, selectedDate);
        }),
        'asc',
      ),
    [matches, selectedDate],
  );

  const upNext = useMemo(() => {
    const t = now.getTime();
    return sortByStart(
      matches.filter(m => {
        const s = getMatchStart(m);
        return !!s && s.getTime() > t && !isSameLocalDay(s, selectedDate);
      }),
      'asc',
    ).slice(0, 5);
  }, [matches, now, selectedDate]);

  const isPastDay = selectedDate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const renderRow = (m: Match, i: number) => {
    const key = matchKey(m, i);
    const animateIn = !animated.current.has(key);
    if (animateIn) animated.current.add(key);
    const card = <MatchCard match={m} now={now} onPress={onMatchPress} variant="compact" index={i} animateIn={animateIn} />;
    // Exit fade only (for swipe-to-remove); a spring layout transition on every row was costly.
    return (
      <Animated.View key={key} exiting={reduced ? undefined : FadeOut.duration(180)}>
        {onRemoveMatch ? <SwipeableMatchRow onRemove={() => onRemoveMatch(m)}>{card}</SwipeableMatchRow> : card}
      </Animated.View>
    );
  };

  return (
    <View>
      <View style={styles.sectionHead}>
        <AppText variant="h3" style={styles.flex} numberOfLines={1}>
          {formatShortDate(selectedDate, now)}
          <AppText variant="smallStrong" color={colors.textMuted}>
            {'  ·  '}
            {relativeDayLabel(selectedDate, now)}
          </AppText>
        </AppText>
        {dayMatches.length > 0 ? (
          <View style={styles.count}>
            <AppText variant="caption" color={palette.green700}>
              {dayMatches.length} {dayMatches.length === 1 ? 'match' : 'matches'}
            </AppText>
          </View>
        ) : null}
      </View>

      {dayMatches.length > 0 ? (
        dayMatches.map(renderRow)
      ) : (
        <View style={styles.emptyDay}>
          <IconTile icon={isPastDay ? 'sleepy' : 'restDay'} tone={isPastDay ? 'slate' : 'teal'} size="md" />
          <View style={[styles.flex, !isPastDay && !onAddForDate && styles.fabRoom]}>
            <AppText variant="title">{isPastDay ? 'Nothing happened here' : 'Free day!'}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {isPastDay
                ? 'No matches were played on this day.'
                : onAddForDate
                  ? `Nothing on ${formatShortDate(selectedDate, now)} yet.`
                  : 'Nothing planned yet. Tap + to add a match.'}
            </AppText>
          </View>
          {!isPastDay && onAddForDate ? (
            <Button label="Add" icon="add" size="sm" variant="sunny" onPress={() => onAddForDate(selectedDate)} />
          ) : null}
        </View>
      )}

      {onRemoveMatch && dayMatches.length > 0 ? (
        <AppText variant="caption" color={colors.textMuted} center style={styles.hint}>
          Swipe a match left to remove it
        </AppText>
      ) : null}

      {upNext.length > 0 ? (
        <>
          <View style={[styles.sectionHead, styles.upNextHead]}>
            <IconTile icon="rocket" tone="violet" size="xs" />
            <AppText variant="h3">Up next</AppText>
          </View>
          {upNext.map(renderRow)}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Keeps copy clear of the Calendar screen's floating + button.
  fabRoom: { paddingRight: 56 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  upNextHead: { marginTop: 18 },
  count: {
    backgroundColor: palette.green50,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  emptyDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: glass.fill,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    padding: 14,
  },
  hint: { marginTop: -4, marginBottom: 4 },
});

export default AgendaList;
