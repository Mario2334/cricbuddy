import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, curve, focusRing, fonts, glass, gradients, palette, radii, shadows, space } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Avatar } from '../../../ui/Avatar';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Button } from '../../../ui/Button';
import { Chip } from '../../../ui/Chip';
import { Icon } from '../../../ui/Icon';
import { haptic } from '../../../utils/haptics';

export interface FeesSheetProps {
  visible: boolean;
  matchFees: string;
  onChangeFees: (value: string) => void;
  availablePlayers: string[];
  selectedPlayers: string[];
  onTogglePlayer: (name: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

function PlayerRow({ name, checked, onPress }: { name: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.playerRow, curve, checked && styles.playerRowChecked, pressed && styles.pressed]}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.playerRim, curve, checked && styles.playerRimChecked]}
      />
      <Avatar name={name} size={30} ring={checked ? palette.green500 : glass.rim} />
      <AppText variant="bodyStrong" numberOfLines={1} style={styles.playerName}>
        {name}
      </AppText>
      <View style={[styles.checkbox, curve, checked && styles.checkboxChecked]}>
        {checked ? (
          <>
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.checkboxFace]}
            />
            <Icon name="check" size={15} weight="bold" color={palette.white} />
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

export function FeesSheet({
  visible,
  matchFees,
  onChangeFees,
  availablePlayers,
  selectedPlayers,
  onTogglePlayer,
  onSelectAll,
  onSelectNone,
  onSubmit,
  onClose,
}: FeesSheetProps) {
  const allSelected = availablePlayers.length > 0 && selectedPlayers.length === availablePlayers.length;
  const [focused, setFocused] = useState(false);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Enter Match Fees"
      icon="money"
      iconTone="amber"
      keyboardAware
      footer={<Button label="Save Match Fees" icon="save" onPress={onSubmit} fullWidth />}
    >
      <View style={styles.feesBlock}>
        <AppText variant="overline" color={colors.textMuted}>
          Match Fees Amount
        </AppText>
        <View style={[styles.inputWrap, curve, focused ? [styles.inputWrapFocused, focusRing] : shadows.soft]}>
          <AppText style={styles.currency} color={colors.primaryStrong}>
            ₹
          </AppText>
          <TextInput
            style={styles.input}
            value={matchFees}
            onChangeText={onChangeFees}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter amount"
            placeholderTextColor={colors.textFaint}
            keyboardType="numeric"
            autoFocus={true}
            selectionColor={colors.primary}
            maxFontSizeMultiplier={1.4}
          />
        </View>
        <AppText variant="small" color={colors.textMuted}>
          Enter the total match fees to be split among players
        </AppText>
      </View>

      {/* Player Selection */}
      {availablePlayers.length > 0 ? (
        <View style={styles.players}>
          <View style={styles.playersHeader}>
            <AppText variant="title" style={styles.playersTitle}>
              Select Players ({selectedPlayers.length}/{availablePlayers.length})
            </AppText>
            <Chip label="All" size="sm" selected={allSelected} onPress={onSelectAll} />
            <Chip label="None" size="sm" tone="neutral" selected={selectedPlayers.length === 0} onPress={onSelectNone} />
          </View>

          <ScrollView style={styles.playersList} contentContainerStyle={styles.playersContent} showsVerticalScrollIndicator={true}>
            {availablePlayers.map((player, index) => (
              <PlayerRow
                key={`player-${index}`}
                name={player}
                checked={selectedPlayers.includes(player)}
                onPress={() => onTogglePlayer(player)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const CHECKBOX = 26;

const styles = StyleSheet.create({
  feesBlock: { gap: space.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: glass.fillSolid,
  },
  inputWrapFocused: { borderColor: palette.green500 },
  currency: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 36, marginRight: space.sm },
  input: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 28,
    color: colors.text,
    paddingVertical: space.md,
    fontVariant: ['tabular-nums'],
  },
  players: { flexShrink: 1, marginTop: space.lg },
  playersHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  playersTitle: { flex: 1 },
  playersList: { flexShrink: 1, maxHeight: 280 },
  playersContent: { gap: space.sm, paddingBottom: space.xs },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    backgroundColor: glass.fillStrong,
  },
  playerRowChecked: { backgroundColor: 'rgba(236,253,245,0.92)', borderColor: 'transparent' },
  playerRim: { borderRadius: radii.md, borderWidth: 1, borderColor: glass.rim },
  playerRimChecked: { borderWidth: 1.5, borderColor: palette.green500 },
  pressed: { transform: [{ scale: 0.98 }] },
  playerName: { flex: 1 },
  checkbox: {
    width: CHECKBOX,
    height: CHECKBOX,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  checkboxChecked: { borderWidth: 0 },
  checkboxFace: { borderRadius: radii.xs },
});

export default FeesSheet;
