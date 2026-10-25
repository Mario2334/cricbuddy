import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { curve, glass, palette, radii, space, text } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Button } from '../../../ui/Button';

export interface PaymentSheetProps {
  visible: boolean;
  message: string;
  onCopy: () => void;
  onClose: () => void;
}

/** Shows the generated payment message as a receipt with a copy button. */
export function PaymentSheet({ visible, message, onCopy, onClose }: PaymentSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Match Payment Details"
      icon="receipt"
      iconTone="amber"
      footer={<Button label="Copy to Clipboard" icon="copy" onPress={onCopy} fullWidth />}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={[styles.receipt, curve]}>
          <AppText style={styles.message} selectable>
            {message}
          </AppText>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1, maxHeight: 420 },
  scrollContent: { paddingBottom: space.sm },
  receipt: {
    padding: space.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.stone300,
    backgroundColor: glass.fillStrong,
  },
  message: { ...text.mono, fontSize: 14, lineHeight: 21 },
});

export default PaymentSheet;
