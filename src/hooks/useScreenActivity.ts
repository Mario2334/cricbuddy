import { useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';

const appIsActive = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

/**
 * Calls `onChange(true)` while this screen is focused and the app is in the
 * foreground, and `onChange(false)` when either stops (and on unmount).
 *
 * Driven by navigation and AppState listeners rather than renders, so it still
 * fires on screens that `freezeOnBlur` has frozen. Outside a navigator (toasts,
 * confetti) the screen counts as focused.
 */
export function useScreenActivity(onChange: (active: boolean) => void, enabled = true): void {
  const navigation = useContext(NavigationContext);
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    let focused = navigation?.isFocused() ?? true;
    let last: boolean | null = null;
    const update = () => {
      const active = focused && appIsActive();
      if (active !== last) {
        last = active;
        callback.current(active);
      }
    };
    update();

    const appSub = AppState.addEventListener('change', update);
    const offFocus = navigation?.addListener('focus', () => {
      focused = true;
      update();
    });
    const offBlur = navigation?.addListener('blur', () => {
      focused = false;
      update();
    });
    return () => {
      appSub.remove();
      offFocus?.();
      offBlur?.();
      if (last) callback.current(false);
    };
  }, [navigation, enabled]);
}

/**
 * Ambient (idle) animation lifecycle: `start` runs when the screen comes on
 * show and `stop` when it goes off (blur, background, unmount, `enabled` off).
 * Never starts with Reduce Motion on. `stop` should cancel and settle to rest.
 */
export function useAmbientLoop(start: () => void, stop: () => void, enabled = true): void {
  const reduced = useReducedMotion();
  const fns = useRef({ start, stop });
  fns.current = { start, stop };
  useScreenActivity(active => (active ? fns.current.start() : fns.current.stop()), enabled && !reduced);
}
