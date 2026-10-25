// Hand-written Reanimated mock for the node test environment.
const chainable = (): any => {
  const target = () => undefined;
  const proxy: any = new Proxy(target, {
    get: (_t, prop) => (prop === 'build' ? () => () => ({ initialValues: {}, animations: {} }) : () => proxy),
    apply: () => proxy,
  });
  return proxy;
};

const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
  ScrollView: 'Animated.ScrollView',
  FlatList: 'Animated.FlatList',
  Image: 'Animated.Image',
  createAnimatedComponent: (c: any) => c,
};

export default Animated;
export const createAnimatedComponent = Animated.createAnimatedComponent;
export const useSharedValue = (v: any) => ({ value: v, get: () => v, set: () => undefined });
export const useAnimatedStyle = () => ({});
export const useAnimatedProps = () => ({});
export const useDerivedValue = (fn: () => any) => ({ value: fn() });
export const useAnimatedReaction = () => undefined;
export const useAnimatedScrollHandler = () => () => undefined;
export const useAnimatedRef = () => ({ current: null });
export const useScrollViewOffset = () => ({ value: 0 });
export const useReducedMotion = () => false;
export const withSpring = (v: any) => v;
export const withTiming = (v: any) => v;
export const withDelay = (_d: number, v: any) => v;
export const withRepeat = (v: any) => v;
export const withSequence = (...v: any[]) => v[v.length - 1];
export const withDecay = () => 0;
export const cancelAnimation = () => undefined;
export const runOnJS = (fn: any) => fn;
export const runOnUI = (fn: any) => fn;
export const interpolate = () => 0;
export const interpolateColor = () => '#000000';
export const measure = () => null;
export const scrollTo = () => undefined;
export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' };
export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  quad: (t: number) => t,
  cubic: (t: number) => t,
  sin: (t: number) => t,
  exp: (t: number) => t,
  bezier: () => (t: number) => t,
  in: (f: any) => f,
  out: (f: any) => f,
  inOut: (f: any) => f,
};
export const FadeIn = chainable();
export const FadeOut = chainable();
export const FadeInDown = chainable();
export const FadeInUp = chainable();
export const FadeOutUp = chainable();
export const FadeOutDown = chainable();
export const ZoomIn = chainable();
export const ZoomOut = chainable();
export const BounceIn = chainable();
export const SlideInRight = chainable();
export const SlideInLeft = chainable();
export const SlideOutLeft = chainable();
export const SlideOutRight = chainable();
export const SlideInDown = chainable();
export const SlideOutDown = chainable();
export const LinearTransition = chainable();
export const Layout = chainable();
