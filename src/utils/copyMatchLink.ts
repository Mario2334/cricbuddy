import Clipboard from '../platform/clipboard';
import Toast from 'react-native-toast-message';
import type { Match } from '../types/Match';
import { matchUrlFor } from './matchLinks';

/** Copy a match link and confirm with a toast (the toast plays the success haptic). */
export async function copyMatchLink(url: string): Promise<void> {
  try {
    await Clipboard.setString(url);
    Toast.show({ type: 'success', text1: 'Match link copied', text2: url, position: 'bottom', visibilityTime: 2200 });
  } catch {
    Toast.show({ type: 'error', text1: "Couldn't copy the link", text2: 'Please try again.', position: 'bottom' });
  }
}

export function copyLinkForMatch(m: Match): void {
  const url = matchUrlFor(m);
  if (url) copyMatchLink(url);
}
