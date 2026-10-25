import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../../theme';
import { Button } from '../../../ui/Button';
import { InfoRow } from '../../../ui/InfoRow';
import { SectionCard } from '../../../ui/SectionCard';

export interface ScheduleCardProps {
  isScheduled: boolean;
  schedulingLoading: boolean;
  hasMatchData: boolean;
  onSchedule: () => void;
  onUnschedule: () => void;
  animateIndex?: number;
}

/** Add/remove this match from the local schedule (confetti fires in the hook on add). */
export function ScheduleCard({
  isScheduled,
  schedulingLoading,
  hasMatchData,
  onSchedule,
  onUnschedule,
  animateIndex,
}: ScheduleCardProps) {
  return (
    <SectionCard
      title="Schedule Match"
      icon="calendar"
      iconTone="sky"
      tone={isScheduled ? 'mint' : 'white'}
      animateIndex={animateIndex}
    >
      <InfoRow
        icon={isScheduled ? 'checks' : 'calendar'}
        label="Attend this match"
        value={isScheduled ? 'This match is in your schedule' : 'Add this match to your schedule to get reminders'}
        tone={isScheduled ? 'emerald' : 'lime'}
        last
      />
      <View style={styles.action}>
        <Button
          label={!hasMatchData ? 'Loading...' : (isScheduled ? 'Remove from Schedule' : 'Add to Schedule')}
          icon={isScheduled ? 'calendarRemove' : 'calendarAdd'}
          variant={isScheduled ? 'danger' : 'primary'}
          onPress={isScheduled ? onUnschedule : onSchedule}
          loading={schedulingLoading}
          disabled={schedulingLoading || !hasMatchData}
          fullWidth
        />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: space.md },
});

export default ScheduleCard;
