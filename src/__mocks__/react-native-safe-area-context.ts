const insets = { top: 0, bottom: 0, left: 0, right: 0 };
export const SafeAreaProvider = ({ children }: { children?: any }) => children ?? null;
export const SafeAreaView = 'SafeAreaView';
export const useSafeAreaInsets = () => insets;
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });
export const initialWindowMetrics = { insets, frame: { x: 0, y: 0, width: 375, height: 812 } };
