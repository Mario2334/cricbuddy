import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Animated, { FadeIn, FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ScheduledMatch } from '../../types/Match';
import apiService from '../../services/apiService';
import { colors, easings, fonts, glass, palette, radii } from '../../theme';
import { combineDateAndTime, toDate } from '../../utils/dates';
import type { MarkedDay } from '../../utils/matchDisplay';
import { useNow } from '../../hooks/useNow';
import { AppText } from '../../ui/AppText';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { Icon } from '../../ui/Icon';
import { MatchDateTimePicker } from './MatchDateTimePicker';
import { isScorecardUrl, parseCricHeroesUrl } from './parseCricHeroesUrl';

interface AddMatchSheetProps {
  visible: boolean;
  /** Day to default the picker to when the API has no start time. */
  initialDate: Date | null;
  markedDates?: Record<string, MarkedDay>;
  onClose: () => void;
  onAdded: (list: ScheduledMatch[], added: ScheduledMatch) => void;
}

/** Two-step sheet: paste a CricHeroes link, then confirm the teams and pick the local date/time. */
export function AddMatchSheet({ visible, initialDate, markedDates, onClose, onAdded }: AddMatchSheetProps) {
  const now = useNow(60_000, { enabled: visible });
  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<ScheduledMatch | null>(null);
  const [when, setWhen] = useState<Date>(() => combineDateAndTime(new Date(), 7, 0));
  const [focused, setFocused] = useState(false);
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, glow]);
  const inputStyle = useAnimatedStyle(() => ({
    borderColor: glow.value > 0.5 ? palette.green500 : glass.rim,
    boxShadow: glow.value > 0.5 ? '0px 0px 0px 4px rgba(16,185,129,0.22)' : '0px 2px 8px rgba(15,23,42,0.06)',
    transform: [{ scale: 1 + glow.value * 0.012 }],
  }));

  const reset = () => {
    setUrlInput('');
    setDetails(null);
    setError(null);
    setFetching(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const valid = isScorecardUrl(urlInput);

  const paste = async () => {
    const text = (await Clipboard.getString())?.trim();
    if (text) {
      setUrlInput(text);
      setError(null);
    }
  };

  const fetchMatchDetails = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a valid CricHeroes URL');
      return;
    }

    setFetching(true);
    setError(null);

    try {
      const parsedMatch = parseCricHeroesUrl(urlInput.trim());

      // Already scheduled?
      const existingMatches = await AsyncStorage.getItem('scheduledMatches');
      if (existingMatches) {
        const scheduledMatchesList: ScheduledMatch[] = JSON.parse(existingMatches);
        if (scheduledMatchesList.some(match => match.matchId === parsedMatch.matchId)) {
          close();
          Toast.show({
            type: 'info',
            text1: 'Already Scheduled',
            text2: 'This match is already in your schedule',
            position: 'bottom',
            visibilityTime: 2000,
          });
          return;
        }
      }

      const matchDetailsResponse = await apiService.getMatchScorecard(
        parsedMatch.matchId,
        parsedMatch.tournamentName,
        `${parsedMatch.team1} vs ${parsedMatch.team2}`,
      );

      if (!matchDetailsResponse.success || !matchDetailsResponse.data) {
        throw new Error('Failed to fetch match details from CricHeroes API');
      }

      const matchData = (matchDetailsResponse.data as any).pageProps.matchData;
      const matchInfo = (matchDetailsResponse.data as any).pageProps.matchInfo;

      if (!matchData && !matchInfo) {
        throw new Error('Match data not found in API response');
      }

      const apiStart: string | undefined =
        matchInfo?.startDateTime || matchInfo?.matchStartTime || matchInfo?.matchDate || matchData?.start_datetime;
      const matchStartTime = apiStart || new Date().toISOString();

      setDetails({
        matchId: parsedMatch.matchId,
        tournamentName: matchInfo?.tournamentName || matchData?.tournament_name || parsedMatch.tournamentName,
        teamNames: {
          team1: matchData?.team_a?.name || parsedMatch.team1,
          team2: matchData?.team_b?.name || parsedMatch.team2,
        },
        groundName: matchInfo?.groundName || matchData?.ground_name,
        groundId: matchData?.ground_id,
        city: matchInfo?.cityName || matchData?.city_name,
        matchStartTime,
        matchType: matchInfo?.matchType || matchData?.match_type || 'T20',
        overs: matchInfo?.overs || matchData?.overs || 20,
        scheduledAt: new Date().toISOString(),
      });

      // Pre-fill in LOCAL time (the old text field showed UTC and saved a shifted time).
      setWhen(toDate(apiStart) ?? combineDateAndTime(initialDate ?? new Date(), 7, 0));
    } catch (err) {
      console.error('Error fetching match details:', err);
      let errorMessage = 'Failed to fetch match details. Please check the URL and try again.';
      if (err instanceof Error) {
        if (err.message.includes('Invalid CricHeroes URL format')) {
          errorMessage = 'Invalid URL format. Please check the CricHeroes scorecard URL.';
        } else if (err.message.includes('Failed to fetch match details') || err.message.includes('Match data not found')) {
          errorMessage = 'Could not fetch match details. The match may be private or restricted.';
        }
      }
      setError(errorMessage);
    } finally {
      setFetching(false);
    }
  };

  const confirmScheduleMatch = async () => {
    if (!details) return;
    try {
      const matchToAdd: ScheduledMatch = { ...details, matchStartTime: when.toISOString() };
      const existingMatches = await AsyncStorage.getItem('scheduledMatches');
      const scheduledMatchesList: ScheduledMatch[] = existingMatches ? JSON.parse(existingMatches) : [];
      scheduledMatchesList.push(matchToAdd);
      await AsyncStorage.setItem('scheduledMatches', JSON.stringify(scheduledMatchesList));
      reset();
      onAdded(scheduledMatchesList, matchToAdd);
    } catch (err) {
      console.error('Error saving match:', err);
      setError('Failed to save match to schedule.');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={details ? 'Confirm match' : 'Add a match'}
      icon={details ? 'calendarCheck' : 'bat'}
      subtitle={details ? 'Check the teams and pick when it starts' : "Paste a CricHeroes scorecard link and we'll do the rest"}
      keyboardAware={!details}
      footer={
        details ? (
          <View style={styles.footerRow}>
            <Button label="Back" variant="secondary" icon="arrowLeft" onPress={() => setDetails(null)} />
            <Button label="Add to calendar" icon="celebrate" onPress={confirmScheduleMatch} style={styles.flex} fullWidth />
          </View>
        ) : (
          <Button
            label="Fetch match"
            icon="search"
            loading={fetching}
            disabled={!urlInput.trim()}
            onPress={fetchMatchDetails}
            fullWidth
          />
        )
      }
    >
      {details ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.step2}>
          <Animated.View entering={FadeInRight.duration(320).easing(easings.out)} style={styles.confirmCard}>
            <AppText variant="overline" color={colors.primaryStrong} numberOfLines={1}>
              {details.tournamentName}
            </AppText>
            <AppText variant="h3" numberOfLines={2}>
              {details.teamNames.team1} <AppText variant="h3" color={palette.lime600}>vs</AppText> {details.teamNames.team2}
            </AppText>
            {details.groundName ? (
              <View style={styles.inline}>
                <Icon name="pin" size={13} weight="fill" color={colors.textMuted} />
                <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
                  {details.groundName}
                  {details.city ? `, ${details.city}` : ''}
                </AppText>
              </View>
            ) : null}
          </Animated.View>
          <MatchDateTimePicker value={when} onChange={setWhen} now={now} markedDates={markedDates} />
          {error ? (
            <AppText variant="smallStrong" color={colors.danger} style={styles.error}>
              {error}
            </AppText>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.step1}>
          <Animated.View style={[styles.inputWrap, inputStyle]}>
            <Icon name="link" size={18} weight="bold" color={colors.textMuted} />
            <TextInput
              value={urlInput}
              onChangeText={t => {
                setUrlInput(t);
                setError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="https://cricheroes.in/scorecard/…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={fetchMatchDetails}
              style={styles.input}
            />
            {valid ? (
              <Animated.View entering={FadeIn}>
                <Icon name="checkCircle" size={22} weight="fill" color={palette.green500} />
              </Animated.View>
            ) : null}
          </Animated.View>
          <View style={styles.row}>
            <Chip label="Paste link" icon="paste" tone="neutral" onPress={paste} />
            {urlInput ? (
              <View style={[styles.inline, styles.flex]}>
                {valid ? <Icon name="checkCircle" size={14} weight="fill" color={colors.primaryStrong} /> : null}
                <AppText variant="caption" color={valid ? colors.primaryStrong : colors.textMuted} style={styles.flex} numberOfLines={2}>
                  {valid ? 'Looks like a scorecard link' : "That doesn't look like a scorecard link yet"}
                </AppText>
              </View>
            ) : null}
          </View>
          {error ? (
            <AppText variant="smallStrong" color={colors.danger} style={styles.error}>
              {error}
            </AppText>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  step1: { paddingBottom: 4 },
  step2: { paddingBottom: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: glass.fillStrong,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 54,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  error: { marginTop: 12 },
  confirmCard: {
    backgroundColor: 'rgba(209,250,229,0.55)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 14,
    marginBottom: 16,
    gap: 2,
  },
  footerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});

export default AddMatchSheet;
