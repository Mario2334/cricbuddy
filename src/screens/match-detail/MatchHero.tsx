import React, { memo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { Match } from '../../types/Match';
import {
  colors,
  curve,
  enter,
  enterUp,
  fonts,
  glass,
  glows,
  gradients,
  palette,
  radii,
  space,
  squircle,
  text,
} from '../../theme';
import { AppText } from '../../ui/AppText';
import { Avatar } from '../../ui/Avatar';
import { DateBadge } from '../../ui/DateBadge';
import { Icon } from '../../ui/Icon';
import { IconTile } from '../../ui/IconTile';
import type { IconName } from '../../ui/icons';
import { BackButton } from '../../ui/ScreenHeader';
import { StatusDateChip } from '../../ui/StatusDateChip';
import { SpinningBall } from '../../ui/CricketBall';
import { formatTime, toDate, type MatchStatus } from '../../utils/dates';

const BAND = 34;
const VS_SIZE = 46;

/** Static, barely-there "mowed" bands: a hint of pitch under the gradient. */
const MowedStripes = React.memo(function MowedStripes() {
  const { width } = useWindowDimensions();
  const count = Math.ceil(width / BAND) + 1;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.stripes]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.band, i % 2 === 0 && styles.bandLight]} />
      ))}
    </View>
  );
});

let orbSeq = 0;

/** Soft radial colour orb. Static: a drifting orb kept the whole hero re-compositing every frame. */
function HeroOrb({ color, opacity, size, style }: { color: string; opacity: number; size: number; style: StyleProp<ViewStyle> }) {
  const id = useRef(`heroOrb${++orbSeq}`).current;
  return (
    <View pointerEvents="none" style={[styles.orb, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Lime + sky glow orbs behind the hero content. */
const HeroOrbs = memo(function HeroOrbs() {
  const { width } = useWindowDimensions();
  const lime = width * 0.85;
  const sky = width * 0.95;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <HeroOrb
        color={palette.yellow300}
        opacity={0.34}
        size={lime}
        style={{ right: -lime * 0.32, top: -lime * 0.42 }}
      />
      <HeroOrb
        color={palette.sky300}
        opacity={0.3}
        size={sky}
        style={{ left: -sky * 0.4, bottom: -sky * 0.55 }}
      />
    </View>
  );
});

function HeroPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={[styles.pill, curve]}>
      <Icon name={icon} size={13} weight="fill" color={palette.yellow200} />
      <AppText variant="caption" color={colors.textOnDark} numberOfLines={1} style={styles.pillText}>
        {label}
      </AppText>
    </View>
  );
}

function TeamSide({ name, index, reduced }: { name: string; index: number; reduced: boolean }) {
  return (
    <Animated.View entering={reduced ? undefined : enterUp(index)} style={styles.team}>
      <Avatar name={name} size={58} ring={glass.rim} />
      <AppText
        style={styles.teamName}
        color={colors.textOnDark}
        numberOfLines={2}
        center
        accessibilityRole="header"
      >
        {name}
      </AppText>
    </Animated.View>
  );
}

export interface MatchHeroProps {
  tournamentName: string;
  teamNames: { team1: string; team2: string };
  matchData: Match | null;
  /** Route param fallback so the badge shows before match data arrives. */
  matchStartTime?: string;
  status: MatchStatus;
  now: Date;
  onBack: () => void;
  /** A background refresh is running (not the first load). */
  updating: boolean;
  /** Live auto-refresh is armed (live match on the scorecard tab). */
  autoRefreshing: boolean;
}

/** Deep emerald pitch header: back button, date badge, teams, pills and result. */
export const MatchHero = memo(function MatchHero({
  tournamentName,
  teamNames,
  matchData,
  matchStartTime,
  status,
  now,
  onBack,
  updating,
  autoRefreshing,
}: MatchHeroProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const start = matchData?.match_start_time || matchData?.start_time || matchStartTime;
  const startDate = toDate(start);

  return (
    <View style={[styles.heroShadow, curve]}>
      <LinearGradient
        colors={gradients.pitch}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, curve, { paddingTop: insets.top + space.sm }]}
      >
        <MowedStripes />
        <HeroOrbs />

        <View style={styles.topRow}>
          <View style={styles.back}>
            <BackButton tone="dark" onPress={onBack} />
          </View>

          <View style={styles.titleCol}>
            <View style={styles.overlineRow}>
              <AppText variant="overline" color={palette.yellow200} numberOfLines={1} style={styles.overline}>
                {tournamentName}
              </AppText>
              {updating ? (
                <Animated.View entering={reduced ? undefined : enter.fade()} style={styles.updating} accessibilityLabel="Updating">
                  <SpinningBall size={16} />
                </Animated.View>
              ) : null}
            </View>
            <StatusDateChip status={status} start={start} now={now} variant="onDark" size="sm" style={styles.statusChip} />
          </View>

          <DateBadge date={start} now={now} status={status} tone="onDark" size="md" />
        </View>

        <View style={styles.teamsRow}>
          <TeamSide name={teamNames.team1} index={1} reduced={reduced} />
          <Animated.View entering={reduced ? undefined : enter.pop(260)} style={[styles.vs, curve, glows.lime]}>
            <View style={[StyleSheet.absoluteFill, styles.vsClip, curve]}>
              <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={gradients.glassSheen} style={styles.vsGloss} />
            </View>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vsRim, curve]} />
            <AppText style={styles.vsText} color={colors.onAccent}>
              VS
            </AppText>
          </Animated.View>
          <TeamSide name={teamNames.team2} index={2} reduced={reduced} />
        </View>

        <Animated.View entering={reduced ? undefined : enter.fade(320)} style={styles.pills}>
          {matchData?.tournament_round_name ? <HeroPill icon="round" label={matchData.tournament_round_name} /> : null}
          {matchData?.ground_name ? <HeroPill icon="pin" label={matchData.ground_name} /> : null}
          {matchData?.match_type && matchData?.overs ? (
            <HeroPill icon="bat" label={`${matchData.match_type} • ${matchData.overs} overs • Cricket`} />
          ) : null}
          {startDate && status !== 'upcoming' ? <HeroPill icon="clock" label={formatTime(startDate)} /> : null}
        </Animated.View>

        {matchData?.match_result ? (
          <Animated.View entering={reduced ? undefined : enter.pop(200)} style={[styles.result, curve, glows.lime]}>
            <View style={[StyleSheet.absoluteFill, styles.resultClip, curve]}>
              <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </View>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.resultRim, curve]} />
            <IconTile icon="trophy" tone="amber" size="xs" style={styles.resultIcon} />
            <AppText variant="bodyStrong" color={colors.onAccent} style={styles.resultText}>
              {matchData.match_result}
            </AppText>
          </Animated.View>
        ) : null}

        {status === 'live' && autoRefreshing ? (
          <View style={styles.autoRefresh}>
            <Icon name="autoRefresh" size={14} weight="bold" color={palette.yellow300} />
            <AppText variant="caption" color={palette.yellow300} style={styles.autoRefreshText}>
              Auto-refreshing every 30s
            </AppText>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  heroShadow: {
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    backgroundColor: palette.emerald800,
    ...glows.emerald,
  },
  hero: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    overflow: 'hidden',
  },
  stripes: { flexDirection: 'row' },
  band: { width: BAND, height: '100%' },
  bandLight: { backgroundColor: 'rgba(255,255,255,0.03)' },
  orb: { position: 'absolute' },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  back: { marginRight: space.md },
  titleCol: { flex: 1, marginRight: space.md },
  overlineRow: { flexDirection: 'row', alignItems: 'center' },
  overline: { flexShrink: 1 },
  updating: { marginLeft: space.sm },
  statusChip: { marginTop: space.xs },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: space.lg,
  },
  team: { flex: 1, alignItems: 'center' },
  teamName: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.3,
    marginTop: space.sm,
  },
  vs: {
    width: VS_SIZE,
    height: VS_SIZE,
    borderRadius: squircle(VS_SIZE),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginHorizontal: space.sm,
  },
  vsClip: { borderRadius: squircle(VS_SIZE), overflow: 'hidden' },
  vsGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: VS_SIZE * 0.55 },
  vsRim: { borderRadius: squircle(VS_SIZE), borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  vsText: { ...text.h3, fontFamily: fonts.displayBold, letterSpacing: 0.2 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: glass.fillDark,
    borderWidth: 1,
    borderColor: glass.rimDark,
  },
  pillText: { marginLeft: 5, flexShrink: 1 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.lg,
    borderRadius: radii.pill,
  },
  resultClip: { borderRadius: radii.pill, overflow: 'hidden' },
  resultRim: { borderRadius: radii.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  resultIcon: { marginRight: space.sm },
  resultText: { flex: 1 },
  autoRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  autoRefreshText: { marginLeft: 6 },
});

export default MatchHero;
