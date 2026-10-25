import React from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../../theme';
import type { MatchDetailModel } from './useMatchDetail';
import { MatchInfoCard } from './cards/MatchInfoCard';
import { GroundDetailsCard, GroundDetailsLoadingCard } from './cards/GroundDetailsCard';
import { ScheduleCard } from './cards/ScheduleCard';
import { ShareCard } from './cards/ShareCard';

export interface InfoTabProps {
  md: MatchDetailModel;
}

export function InfoTab({ md }: InfoTabProps) {
  const insets = useSafeAreaInsets();
  let i = 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={
        <RefreshControl
          refreshing={md.refreshing}
          onRefresh={md.onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      showsVerticalScrollIndicator={true}
    >
      <MatchInfoCard
        tournamentName={md.tournamentName}
        teamNames={md.teamNames}
        groundName={md.groundName}
        city={md.city}
        animateIndex={i++}
      />

      {/* Ground Details Section */}
      {md.groundData ? <GroundDetailsCard ground={md.groundData} animateIndex={i++} /> : null}

      {/* Loading state for ground details (only before the first ground arrives) */}
      {md.groundLoading && !md.groundData ? <GroundDetailsLoadingCard animateIndex={i++} /> : null}

      {/* Schedule Match Section - Only for upcoming matches */}
      {md.matchStatus === 'upcoming' ? (
        <ScheduleCard
          isScheduled={md.isScheduled}
          schedulingLoading={md.schedulingLoading}
          hasMatchData={!!md.matchData}
          onSchedule={md.scheduleMatch}
          onUnschedule={md.unscheduleMatch}
          animateIndex={i++}
        />
      ) : null}

      {/* WhatsApp Copy Section */}
      <ShareCard
        selectedGroundLabel={md.selectedGroundForWhatsApp?.name || md.groundName || 'Select Ground'}
        selectedBallJersey={md.selectedBallJersey}
        showPayments={md.isTeam5179117Match}
        searchingPlaces={md.searchingPlaces}
        onPickGround={() => {
          md.fetchAvailableGrounds();
          md.setShowGroundDropdown(true);
        }}
        onPickBallJersey={() => md.setShowBallJerseyDropdown(true)}
        onCopyToWhatsApp={md.copyToWhatsApp}
        onWritePayments={md.openFeesInputDialog}
        animateIndex={i++}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.lg },
});

export default InfoTab;
