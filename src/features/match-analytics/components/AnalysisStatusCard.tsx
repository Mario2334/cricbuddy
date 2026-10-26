import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Button } from '../../../ui/Button';
import { Chip } from '../../../ui/Chip';
import { IconTile } from '../../../ui/IconTile';
import { InfoRow } from '../../../ui/InfoRow';
import { SectionCard } from '../../../ui/SectionCard';
import type { AnalyticsError } from '../services/analyticsApiClient';
import type { AnalysisJob, AnalysisReport } from '../types';
import { agoLabel, elapsedLabel, statusLabel } from '../utils/format';

export interface AnalysisStatusCardProps {
  job: AnalysisJob | null;
  report: AnalysisReport | null;
  stale: boolean;
  active: boolean;
  requesting: boolean;
  capReached: boolean;
  error: AnalyticsError | null;
  now: Date;
  onRequest: () => void;
  animateIndex?: number;
}

/** Build / progress / ready / failed states for the AI game plan. */
export function AnalysisStatusCard({ job, report, stale, active, requesting, capReached, error, now, onRequest, animateIndex }: AnalysisStatusCardProps) {
  const failed = job?.status === 'failed';
  const hasPlan = !!report;
  const buttonLabel = hasPlan || failed ? (failed && !hasPlan ? 'Try again' : 'Re-run the plan') : 'Build game plan';

  return (
    <SectionCard title="Game plan" icon="ai" iconTone="violet" tone={hasPlan ? 'mint' : 'white'} subtitle={hasPlan ? report.ai.headline : undefined} animateIndex={animateIndex}>
      {active ? (
        <View style={styles.progress}>
          <IconTile icon="ai" tone="violet" variant="soft" glow size="md" />
          <View style={styles.texts}>
            <AppText variant="bodyStrong">{statusLabel(job)}</AppText>
            <AppText variant="small" color={colors.textSoft}>
              {`${elapsedLabel(job?.started_at ?? job?.requested_at, now) || '0s'} · usually 2–3 minutes. You can leave this screen.`}
            </AppText>
          </View>
        </View>
      ) : null}

      {!active && hasPlan ? (
        <InfoRow
          icon="checkCircle"
          tone="emerald"
          label={`Plan ready · ${agoLabel(report.finished_at, now)}`}
          value={`${report.model} · confidence ${report.ai.confidence}`}
          right={stale ? <Chip size="sm" label="Availability changed" tone="yellow" selected /> : undefined}
          last
        />
      ) : null}

      {!active && failed ? <InfoRow icon="warning" tone="rose" label="The last run failed" value={job?.error ?? 'Unknown error'} last /> : null}

      {!active && !hasPlan && !failed ? (
        <AppText variant="body" color={colors.textSoft}>
          Reads the opposition's last five matches, our recent form, the ground's history and who's available, then picks the XII, the batting order and a bowling plan.
        </AppText>
      ) : null}

      {error && error.kind !== 'cap' ? (
        <AppText variant="small" color={colors.textSoft} style={styles.error}>
          {error.message}
        </AppText>
      ) : null}

      {!active ? (
        <View style={styles.action}>
          <Button label={buttonLabel} icon="strategy" variant={hasPlan ? 'secondary' : 'primary'} onPress={onRequest} loading={requesting} disabled={requesting || capReached} fullWidth />
          {capReached ? (
            <AppText variant="caption" color={colors.textSoft} center style={styles.cap}>
              Today's limit of game plans is used up. Try again tomorrow.
            </AppText>
          ) : null}
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  texts: { flex: 1 },
  action: { marginTop: space.md },
  cap: { marginTop: space.xs },
  error: { marginTop: space.sm },
});

export default AnalysisStatusCard;
