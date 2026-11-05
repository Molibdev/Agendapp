import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
let reducedMotion = true;
const motionListeners = new Set<() => void>();
function subscribeMotion(listener: () => void) {
  motionListeners.add(listener);
  const update = (value: boolean) => {
    reducedMotion = value;
    motionListeners.forEach((fn) => fn());
  };
  if (motionListeners.size === 1) {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => {});
    motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      update,
    );
  }
  return () => {
    motionListeners.delete(listener);
    if (!motionListeners.size) {
      motionSubscription?.remove();
      motionSubscription = undefined;
    }
  };
}
let motionSubscription:
  | ReturnType<typeof AccessibilityInfo.addEventListener>
  | undefined;
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => reducedMotion,
    () => true,
  );
}
export function useSectionTransition<T extends string>(initial: T) {
  const reduced = useReducedMotion(),
    [current, setCurrent] = useState(initial);
  const desired = useRef(initial);
  const opacity = useRef(new Animated.Value(1)).current,
    y = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const enter = useCallback(() => {
    animation.current = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        isInteraction: false,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 100,
        isInteraction: false,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.current.start();
  }, [opacity, y]);
  useEffect(() => {
    if (!reduced) return;
    animation.current?.stop();
    opacity.setValue(1);
    y.setValue(0);
  }, [reduced, opacity, y]);
  useEffect(
    () => () => {
      animation.current?.stop();
    },
    [],
  );
  const navigate = useCallback(
    (next: T) => {
      if (next === desired.current) return;
      desired.current = next;
      animation.current?.stop();
      // Commit the destination in the press handler: navigation never waits for
      // an animation callback or renders the old screen with a new selection.
      // Keep the destination readable throughout the brief entry animation.
      opacity.setValue(reduced ? 1 : 0.94);
      y.setValue(reduced ? 0 : 2);
      setCurrent(next);
      if (!reduced) enter();
    },
    [reduced, opacity, y, enter],
  );
  return {
    current,
    selected: current,
    navigate,
    style: { opacity, transform: [{ translateY: y }] },
  };
}
