// Mock React Native components for testing
export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const TouchableOpacity = 'TouchableOpacity';
export const FlatList = 'FlatList';
export const Modal = 'Modal';
export const ActivityIndicator = 'ActivityIndicator';
export const Image = 'Image';
export const RefreshControl = 'RefreshControl';
export const Keyboard = {
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  dismiss: jest.fn(),
};

export const StyleSheet = {
  create: (styles: any) => styles,
  hairlineWidth: 1,
};

export const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

export const Platform = {
  OS: 'ios',
  select: jest.fn((obj) => obj.ios),
};

export const Alert = {
  alert: jest.fn(),
};

export const Linking = {
  openURL: jest.fn(),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
};
export const SafeAreaView = 'SafeAreaView';
export const ScrollView = 'ScrollView';
export const SectionList = 'SectionList';
export const Pressable = 'Pressable';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
export const ImageBackground = 'ImageBackground';
export const Switch = 'Switch';
export const TouchableWithoutFeedback = 'TouchableWithoutFeedback';
export const StatusBar = Object.assign('StatusBar', { setBarStyle: jest.fn(), setBackgroundColor: jest.fn() });

const animatedValue = () => ({
  setValue: jest.fn(),
  interpolate: jest.fn(() => 0),
  addListener: jest.fn(),
  removeAllListeners: jest.fn(),
});
const animation = () => ({ start: jest.fn((cb?: () => void) => cb?.()), stop: jest.fn(), reset: jest.fn() });
export const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
  ScrollView: 'Animated.ScrollView',
  FlatList: 'Animated.FlatList',
  Value: jest.fn(animatedValue),
  timing: jest.fn(animation),
  spring: jest.fn(animation),
  loop: jest.fn(animation),
  sequence: jest.fn(animation),
  parallel: jest.fn(animation),
  event: jest.fn(() => jest.fn()),
  createAnimatedComponent: (c: any) => c,
};

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  bezier: () => (t: number) => t,
  in: (f: any) => f,
  out: (f: any) => f,
  inOut: (f: any) => f,
};

export const Vibration = { vibrate: jest.fn(), cancel: jest.fn() };
export const Share = { share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })) };
export const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};
export const AccessibilityInfo = {
  isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
  isReduceTransparencyEnabled: jest.fn(() => Promise.resolve(false)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};
export const PixelRatio = { get: () => 2, getFontScale: () => 1, roundToNearestPixel: (n: number) => n };
export const useColorScheme = () => 'light';
export const I18nManager = { isRTL: false };
export const PanResponder = { create: jest.fn(() => ({ panHandlers: {} })) };
export const useWindowDimensions = () => ({ width: 375, height: 812, scale: 2, fontScale: 1 });
