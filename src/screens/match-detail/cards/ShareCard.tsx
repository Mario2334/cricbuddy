import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, curve, glass, radii, shadows, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { InfoRow } from '../../../ui/InfoRow';
import { SectionCard } from '../../../ui/SectionCard';

export interface ShareCardProps {
  selectedGroundLabel: string;
  selectedBallJersey: string;
  /** Only team 5179117's matches get the "Write Payments" helper. */
  showPayments: boolean;
  searchingPlaces: boolean;
  onPickGround: () => void;
  onPickBallJersey: () => void;
  onCopyToWhatsApp: () => void;
  onCopyLink: () => void;
  onWritePayments: () => void;
  animateIndex?: number;
}

// The picker pill carries its own chevron, so suppress InfoRow's default one.
function PickerValue({ label }: { label: string }) {
  return (
    <View style={[styles.picker, curve]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pickerRim, curve]} />
      <AppText variant="bodyStrong" numberOfLines={1} style={styles.pickerText}>
        {label}
      </AppText>
      <Icon name="chevronDown" size={16} weight="bold" color={colors.textSoft} />
    </View>
  );
}

export function ShareCard({
  selectedGroundLabel,
  selectedBallJersey,
  showPayments,
  searchingPlaces,
  onPickGround,
  onPickBallJersey,
  onCopyToWhatsApp,
  onCopyLink,
  onWritePayments,
  animateIndex,
}: ShareCardProps) {
  return (
    <SectionCard
      title="Share Match Details"
      subtitle="Build the squad message for WhatsApp"
      icon="whatsapp"
      iconTone="emerald"
      tone="butter"
      animateIndex={animateIndex}
    >
      <InfoRow
        icon="pin"
        label="Selected Ground"
        value={<PickerValue label={selectedGroundLabel} />}
        onPress={onPickGround}
        showChevron={false}
        tone="emerald"
      />
      <InfoRow
        icon="jersey"
        label="Ball & Jersey"
        value={<PickerValue label={selectedBallJersey} />}
        onPress={onPickBallJersey}
        showChevron={false}
        tone="amber"
        last
      />

      <View style={styles.actions}>
        <Button
          label="Copy to WhatsApp"
          icon="whatsapp"
          variant="whatsapp"
          onPress={onCopyToWhatsApp}
          loading={searchingPlaces}
          fullWidth
        />
        <Button label="Copy match link" icon="link" variant="secondary" onPress={onCopyLink} haptic={false} fullWidth />
        {showPayments ? (
          <Button
            label="Write Payments"
            icon="card"
            variant="sunny"
            onPress={onWritePayments}
            fullWidth
          />
        ) : null}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xs,
    paddingVertical: 7,
    paddingLeft: space.md,
    paddingRight: space.sm + 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: glass.fillSolid,
    ...shadows.soft,
  },
  pickerRim: { borderRadius: radii.pill, borderWidth: 1, borderColor: glass.rim },
  pickerText: { flex: 1, marginRight: space.sm },
  actions: { gap: space.md, marginTop: space.md },
});

export default ShareCard;
