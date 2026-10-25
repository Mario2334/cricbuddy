const passthrough = ({ children }: { children?: any }) => children ?? null;
const chainable = (): any => {
  const proxy: any = new Proxy(() => undefined, { get: () => () => proxy, apply: () => proxy });
  return proxy;
};
export const GestureHandlerRootView = passthrough;
export const GestureDetector = passthrough;
export const Gesture = chainable();
export const Swipeable = 'Swipeable';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const State = {};
export const Directions = {};
const ReanimatedSwipeable = 'ReanimatedSwipeable';
export default ReanimatedSwipeable;
