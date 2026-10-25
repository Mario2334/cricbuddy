import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Linking, Alert, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { RecruitmentPost } from '../types';
import { colors, enter, fonts, glass, palette, radii } from '../../../theme';
import { cleanHtmlText } from '../../../utils/text';
import { AppText } from '../../../ui/AppText';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { Chip } from '../../../ui/Chip';
import { DateBadge } from '../../../ui/DateBadge';
import { GlassView } from '../../../ui/GlassView';
import { Icon } from '../../../ui/Icon';
import { IconTile } from '../../../ui/IconTile';
import type { IconName } from '../../../ui/icons';
import { InfoRow } from '../../../ui/InfoRow';
import { SectionCard } from '../../../ui/SectionCard';
import { useNow } from '../../../hooks/useNow';
import { formatFullDate, relativeDayLabel, toDate } from '../../../utils/dates';
import { haptic } from '../../../utils/haptics';
import { ballIcon, firstValidDate, positionIcon, positionTone, postedLabel } from './PostCard';

interface PostDetailComponentProps {
  post: RecruitmentPost;
  onClose?: () => void;
  onContactPress?: (contactInfo: RecruitmentPost['user']['contactDetails']) => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Footer CTA bar geometry (Button size="lg" is 56pt tall).
const FOOTER_PAD_TOP = 12;
const FOOTER_BUTTON_HEIGHT = 56;
const ROUND_BUTTON = 40;

const titleCase = (s: string) =>
  s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

/** Frosted glass circle holding a single icon (sheet close / share). */
function RoundIconButton({
  icon,
  onPress,
  label,
  color = colors.text,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [pressed && styles.roundButtonPressed]}
    >
      <GlassView mode="frost" radius={ROUND_BUTTON / 2} shadow="soft" style={styles.roundButton}>
        <Icon name={icon} size={20} weight="bold" color={color} />
      </GlassView>
    </Pressable>
  );
}

const PostDetailComponent: React.FC<PostDetailComponentProps> = ({
  post,
  onClose,
  onContactPress,
}) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const now = useNow();

  const formatPositions = (positions: string[]) => {
    if (positions.length === 0) return 'Any position';
    return positions.join(', ');
  };

  const handleContactPress = async (type: 'phone' | 'email' | 'whatsapp' | 'telegram') => {
    const { contactDetails } = post.user;

    try {
      switch (type) {
        case 'phone':
          if (contactDetails.phone) {
            await Linking.openURL(`tel:${contactDetails.phone}`);
          }
          break;
        case 'email':
          if (contactDetails.email) {
            await Linking.openURL(`mailto:${contactDetails.email}`);
          }
          break;
        case 'whatsapp':
          if (contactDetails.whatsapp) {
            await Linking.openURL(`whatsapp://send?phone=${contactDetails.whatsapp}`);
          }
          break;
        case 'telegram':
          if (contactDetails.telegram) {
            await Linking.openURL(`tg://resolve?domain=${contactDetails.telegram}`);
          }
          break;
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open contact method');
    }

    if (onContactPress) {
      onContactPress(contactDetails);
    }
  };

  const handleLocationPress = () => {
    const { location } = post;
    const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open maps');
    });
  };

  const handleShare = async () => {
    try {
      const message = `Cricket Match Opportunity!\n\n` +
        `Looking for: ${formatPositions(post.requirements.positionsNeeded)}\n` +
        `Level: ${post.requirements.skillLevel}\n` +
        `Format: ${post.matchDetails.matchFormat.toUpperCase()}\n` +
        `Location: ${post.location.venue || post.location.cityName}\n` +
        `Contact: ${post.user.name}`;

      await Share.share({
        message,
        title: 'Cricket Match Opportunity',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const { contactDetails } = post.user;
  const { ballType, groundType } = post.matchDetails;
  const positions = formatPositions(post.requirements.positionsNeeded);
  const description = cleanHtmlText(post.requirements.description);
  const comments = cleanHtmlText(post.matchDetails.comments);
  const date = firstValidDate(post.timing.specificDates);
  const otherDates = (post.timing.specificDates || [])
    .map(d => toDate(d))
    .filter((d): d is Date => !!d)
    .slice(1);
  const schedule = post.timing.recurringSchedule;
  const hasMainContacts = !!(contactDetails.phone || contactDetails.whatsapp);
  const hasOtherContacts = !!(contactDetails.email || contactDetails.telegram);
  const venue = (post.location.venue || '').trim();
  const headIcon = positionIcon(post.requirements.positionsNeeded);
  const ball = ballIcon(ballType);
  const footerBottom = Math.max(insets.bottom, 12) + 4;
  const footerHeight = FOOTER_PAD_TOP + FOOTER_BUTTON_HEIGHT + footerBottom;

  // Skill level, team type and preferred times are hard-coded placeholders in
  // the API client, so they are not shown here.
  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.grabber} />
        <View style={styles.topBarRow}>
          {onClose ? <RoundIconButton icon="close" label="Close" onPress={onClose} /> : <View style={styles.roundSpacer} />}
          <RoundIconButton icon="share" label="Share post" onPress={handleShare} color={colors.primaryStrong} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        // The CTA bar floats over the content (so it blurs what scrolls under it); leave room for it.
        contentContainerStyle={[styles.content, { paddingBottom: (hasMainContacts ? footerHeight + 24 : insets.bottom + 24) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Who + what */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Animated.View entering={reduced ? undefined : enter.pop()}>
              <Avatar name={post.user.name} uri={post.user.profilePhoto} size={64} ring={palette.white} />
            </Animated.View>
            <View style={styles.heroWho}>
              <AppText variant="h2" numberOfLines={2}>
                {post.user.name}
              </AppText>
              <AppText variant="smallStrong" color={colors.textMuted} numberOfLines={1}>
                Posted {postedLabel(post, now)}
              </AppText>
            </View>
            {date ? <DateBadge date={date} now={now} size="md" showRelative delay={200} /> : null}
          </View>

          <View style={styles.headlineRow}>
            <IconTile icon={headIcon} tone={positionTone(headIcon)} size="md" />
            <AppText style={styles.headline}>
              Looking for <AppText style={styles.headlineStrong} color={colors.primaryStrong}>{positions}</AppText>
            </AppText>
          </View>

          <View style={styles.chips}>
            <Chip tone="yellow" icon={ball} label={`${titleCase(ballType)} ball`} />
            <Chip tone="green" label={titleCase(groundType)} />
          </View>
        </View>

        {description ? (
          <SectionCard title="About" icon="info" iconTone="sky" animateIndex={0} style={styles.section}>
            <AppText variant="body" color={colors.textSoft}>
              {description}
            </AppText>
          </SectionCard>
        ) : null}

        <SectionCard title="Match details" icon="bat" animateIndex={1} style={styles.section}>
          <InfoRow icon="team" tone="violet" label="Positions needed" value={positions} />
          <InfoRow icon={ball} tone="lime" label="Ball type" value={`${titleCase(ballType)} ball`} />
          <InfoRow icon="stadium" tone="emerald" label="Ground" value={titleCase(groundType)} last={!comments || comments === description} />
          {comments && comments !== description ? (
            <InfoRow icon="comment" tone="sky" label="Additional comments" value={comments} numberOfLines={6} last />
          ) : null}
        </SectionCard>

        <SectionCard title="When" icon="calendar" iconTone="violet" animateIndex={2} style={styles.section}>
          {date ? (
            <>
              <InfoRow
                icon="calendar"
                tone="violet"
                label={relativeDayLabel(date, now)}
                value={formatFullDate(date)}
                last={otherDates.length === 0 && !schedule}
              />
              {otherDates.length > 0 ? (
                <InfoRow
                  icon="calendarCheck"
                  tone="violet"
                  label="Also on"
                  value={otherDates.map(d => formatFullDate(d)).join('\n')}
                  numberOfLines={otherDates.length}
                  last={!schedule}
                />
              ) : null}
            </>
          ) : (
            <InfoRow
              icon={post.timing.isLongTerm ? 'calendar' : 'sparkle'}
              tone={post.timing.isLongTerm ? 'violet' : 'lime'}
              label="Timing"
              value={post.timing.isLongTerm ? 'Long term' : 'Flexible timing'}
              last={!schedule}
            />
          )}
          {schedule ? (
            <InfoRow
              icon="timer"
              tone="sky"
              label={`Recurring (${schedule.frequency})`}
              value={
                schedule.daysOfWeek.map(day => DAY_NAMES[day]).filter(Boolean).join(', ') +
                (schedule.duration
                  ? ` · ${schedule.duration} ${schedule.frequency === 'weekly' ? 'weeks' : 'months'}`
                  : '')
              }
              last
            />
          ) : null}
        </SectionCard>

        <SectionCard title="Where" icon="pin" iconTone="rose" animateIndex={3} style={styles.section}>
          <InfoRow
            icon="pin"
            tone="rose"
            label={venue ? 'Venue' : 'City'}
            value={
              <View>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {venue || post.location.cityName || 'Venue not specified'}
                </AppText>
                {venue && post.location.cityName ? (
                  <AppText variant="small" color={colors.textMuted}>
                    {post.location.cityName}
                  </AppText>
                ) : null}
              </View>
            }
            onPress={handleLocationPress}
            last
          />
          <Button
            label="Open in Maps"
            icon="map"
            variant="secondary"
            size="md"
            fullWidth
            onPress={handleLocationPress}
            style={styles.mapsButton}
          />
        </SectionCard>

        {hasOtherContacts ? (
          <SectionCard title="More ways to reach" icon="phone" iconTone="teal" animateIndex={4} style={styles.section}>
            <View style={styles.otherContacts}>
              {contactDetails.email ? (
                <Button label="Email" icon="email" variant="secondary" fullWidth onPress={() => handleContactPress('email')} />
              ) : null}
              {contactDetails.telegram ? (
                <Button label="Telegram" icon="telegram" variant="secondary" fullWidth onPress={() => handleContactPress('telegram')} />
              ) : null}
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>

      {hasMainContacts ? (
        // Real blur is safe here: the sheet slides in (transform only), nothing fades this bar.
        <GlassView
          mode="blur"
          radius={0}
          rim={false}
          shadow="none"
          style={[styles.footer, { paddingBottom: footerBottom }]}
        >
          {contactDetails.phone ? (
            <Button
              label="Call"
              icon="phone"
              variant="primary"
              size="lg"
              haptic="medium"
              onPress={() => handleContactPress('phone')}
              style={styles.footerButton}
            />
          ) : null}
          {contactDetails.whatsapp ? (
            <Button
              label="WhatsApp"
              icon="whatsapp"
              variant="whatsapp"
              size="lg"
              haptic="medium"
              onPress={() => handleContactPress('whatsapp')}
              style={styles.footerButton}
            />
          ) : null}
        </GlassView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // Transparent: the sheet's calm mesh background shows through.
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: 8,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundButton: {
    width: ROUND_BUTTON,
    height: ROUND_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonPressed: {
    transform: [{ scale: 0.92 }],
  },
  roundSpacer: {
    width: ROUND_BUTTON,
    height: ROUND_BUTTON,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hero: {
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroWho: {
    flex: 1,
    paddingTop: 4,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  headline: {
    flex: 1,
    fontFamily: fonts.displayMedium,
    fontSize: 24,
    lineHeight: 31,
    color: colors.text,
  },
  headlineStrong: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 31,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  section: {
    marginBottom: 14,
  },
  mapsButton: {
    marginTop: 12,
  },
  otherContacts: {
    gap: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: FOOTER_PAD_TOP,
    borderTopWidth: 1,
    borderTopColor: glass.rim,
  },
  footerButton: {
    flex: 1,
  },
});

export default PostDetailComponent;
