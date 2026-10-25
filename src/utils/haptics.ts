import * as Haptics from 'expo-haptics';

export type HapticKind = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/** Fire-and-forget haptic. Never throws, never blocks. */
export function haptic(kind: HapticKind = 'light'): void {
  if (!enabled) return;
  try {
    let p: Promise<void> | undefined;
    switch (kind) {
      case 'selection':
        p = Haptics.selectionAsync();
        break;
      case 'light':
        p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
    p?.catch(() => undefined);
  } catch {
    // Haptics unavailable (simulator, test env); ignore.
  }
}
