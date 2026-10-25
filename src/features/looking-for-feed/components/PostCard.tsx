import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, curve, fonts, glass, shadows, squircle, tones, type IconTone } from '../../../theme';
import { cleanHtmlText } from '../../../utils/text';
import { AppText } from '../../../ui/AppText';
import { Avatar } from '../../../ui/Avatar';
import { Chip } from '../../../ui/Chip';
import { DateBadge } from '../../../ui/DateBadge';
import { Icon } from '../../../ui/Icon';
import { IconTile } from '../../../ui/IconTile';
import type { IconName } from '../../../ui/icons';
import { PlayCard } from '../../../ui/PlayCard';
import { relativeDayLabel, toDate } from '../../../utils/dates';
import { BallType, RecruitmentPost } from '../types';

export interface PostCardProps {
  post: RecruitmentPost;
  index: number;
  now: Date;
  onPress: (post: RecruitmentPost) => void;
}

export const formatPositions = (positions: string[]): string => {
  const clean = positions.filter(p => typeof p === 'string' && p.trim().length > 0);
  if (clean.length === 0) return 'Any position';
  if (clean.length <= 2) return clean.join(', ');
  return `${clean.slice(0, 2).join(', ')} +${clean.length - 2} more`;
};

/** First specific date that is a real date, or null. */
export const firstValidDate = (dates?: Date[]): Date | null => {
  if (!dates || dates.length === 0) return null;
  for (const d of dates) {
    const parsed = toDate(d);
    if (parsed) return parsed;
  }
  return null;
};

/** "5 mins ago" from the API when we have it, otherwise a day-level label. */
export const postedLabel = (post: RecruitmentPost, now: Date): string => {
  if (post.timeAgo) return post.timeAgo;
  const created = toDate(post.createdAt);
  return created ? relativeDayLabel(created, now).toLowerCase() : 'recently';
};

export const positionIcon = (positions: string[]): IconName => {
  const text = positions.join(' ').toLowerCase();
  if (/keep/.test(text)) return 'gloves';
  if (/all.?round/.test(text)) return 'star';
  if (/bowl|spin|pace|seam/.test(text)) return 'target';
  if (/bat|open/.test(text)) return 'bat';
  if (/umpire|scor/.test(text)) return 'timer';
  if (/team|opponent|side|squad|player/.test(text)) return 'team';
  return 'hands';
};

const POSITION_TONES: Partial<Record<IconName, IconTone>> = {
  gloves: 'teal',
  star: 'amber',
  target: 'rose',
  bat: 'emerald',
  timer: 'sky',
  team: 'violet',
};

/** Tile tone that goes with `positionIcon`. */
export const positionTone = (icon: IconName): IconTone => POSITION_TONES[icon] ?? 'emerald';

const titleCase = (s: string) =>
  s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

export const ballIcon = (ballType: BallType): IconName => (ballType === BallType.TENNIS ? 'tennis' : 'ball');

/** Location line: venue plus city when the venue doesn't already mention it. */
const locationLabel = (post: RecruitmentPost): string => {
  const venue = (post.location.venue || '').trim();
  const city = (post.location.cityName || '').trim();
  if (!venue) return city;
  if (!city || venue.toLowerCase().includes(city.toLowerCase())) return venue;
  return `${venue} · ${city}`;
};

/** Small glass squircle shown in place of a date badge when there is no fixed date. */
function WhenSticker({ longTerm }: { longTerm: boolean }) {
  const tone = longTerm ? tones.emerald : tones.lime;
  return (
    <View
      style={styles.sticker}
      accessible
      accessibilityLabel={longTerm ? 'Long term' : 'Flexible timing'}
    >
      <View pointerEvents="none" style={styles.stickerRim} />
      <Icon name={longTerm ? 'calendar' : 'sparkle'} size={18} color={tone.softInk} />
      <AppText style={styles.stickerText} color={tone.softInk} center>
        {longTerm ? 'Long\nterm' : 'Flexible'}
      </AppText>
    </View>
  );
}

/** One "Looking for" post: who, what they need, when and where. */
function PostCardBase({ post, index, now, onPress }: PostCardProps) {
  const date = firstValidDate(post.timing.specificDates);
  const positions = formatPositions(post.requirements.positionsNeeded);
  const where = locationLabel(post);
  const description = cleanHtmlText(post.requirements.description);
  const { ballType, groundType } = post.matchDetails;
  const headIcon = positionIcon(post.requirements.positionsNeeded);

  return (
    <PlayCard
      animateIndex={index}
      onPress={() => onPress(post)}
      // The feed's interaction handler already fires a haptic on press.
      haptic={false}
      accessibilityLabel={`${post.user.name} is looking for ${positions}`}
      style={styles.card}
    >
      <View style={styles.header}>
        <Avatar name={post.user.name} uri={post.user.profilePhoto} size={44} />
        <View style={styles.who}>
          <AppText variant="title" numberOfLines={1}>
            {post.user.name}
          </AppText>
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
            Posted {postedLabel(post, now)}
          </AppText>
        </View>
        {date ? (
          <DateBadge date={date} now={now} size="sm" showRelative delay={Math.min(index, 8) * 50 + 180} />
        ) : (
          <WhenSticker longTerm={post.timing.isLongTerm} />
        )}
      </View>

      <View style={styles.headlineRow}>
        <IconTile icon={headIcon} tone={positionTone(headIcon)} size="sm" />
        <AppText style={styles.headline} numberOfLines={2}>
          Looking for <AppText style={styles.headlineStrong} color={colors.primaryStrong}>{positions}</AppText>
        </AppText>
      </View>

      <View style={styles.chips}>
        {ballType ? <Chip size="sm" tone="yellow" icon={ballIcon(ballType)} label={`${titleCase(ballType)} ball`} /> : null}
        {groundType ? <Chip size="sm" tone="green" label={titleCase(groundType)} /> : null}
      </View>

      {where ? (
        <View style={styles.location}>
          <Icon name="pin" size={16} weight="fill" color={tones.rose.to} />
          <AppText variant="smallStrong" color={colors.textSoft} numberOfLines={1} style={styles.locationText}>
            {where}
          </AppText>
        </View>
      ) : null}

      {description ? (
        <AppText variant="small" color={colors.textSoft} numberOfLines={2} style={styles.description}>
          {description}
        </AppText>
      ) : null}
    </PlayCard>
  );
}

export const PostCard = memo(PostCardBase);

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  who: { flex: 1, paddingTop: 2 },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  headline: {
    flex: 1,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  headlineStrong: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 26 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { flex: 1 },
  description: { marginTop: 6 },
  // Same height as DateBadge's sm size (52) so card headers line up either way.
  sticker: {
    width: 52,
    minHeight: 52,
    borderRadius: squircle(52),
    ...curve,
    backgroundColor: glass.fillStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 5,
    ...shadows.soft,
  },
  stickerRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: squircle(52),
    ...curve,
    borderWidth: 1,
    borderColor: glass.rim,
  },
  stickerText: { fontFamily: fonts.bodyBlack, fontSize: 10, lineHeight: 12, letterSpacing: 0.3 },
});

export default PostCard;
