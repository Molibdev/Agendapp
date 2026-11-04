import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return reduced;
}
export function useSectionTransition<T extends string>(initial: T) {
  const reduced = useReducedMotion(),
    [current, setCurrent] = useState(initial),
    [selected, setSelected] = useState(initial);
  const rendered = useRef(initial),
    desired = useRef(initial),
    generation = useRef(0),
    entering = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current,
    y = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const enter = useCallback(() => {
    animation.current = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.current.start();
  }, [opacity, y]);
  useEffect(() => {
    if (entering.current) {
      entering.current = false;
      enter();
    }
  }, [current, enter]);
  useEffect(() => {
    if (!reduced) return;
    generation.current++;
    animation.current?.stop();
    entering.current = false;
    opacity.setValue(1);
    y.setValue(0);
    rendered.current = desired.current;
    setCurrent(desired.current);
  }, [reduced, opacity, y]);
  useEffect(
    () => () => {
      generation.current++;
      animation.current?.stop();
    },
    [],
  );
  const navigate = useCallback(
    (next: T) => {
      if (next === desired.current) return;
      desired.current = next;
      setSelected(next);
      const id = ++generation.current;
      animation.current?.stop();
      entering.current = false;
      if (reduced) {
        rendered.current = next;
        setCurrent(next);
        opacity.setValue(1);
        y.setValue(0);
        return;
      }
      // Cancelling an opening transition restores the still-visible screen.
      if (next === rendered.current) {
        enter();
        return;
      }
      animation.current = Animated.timing(opacity, {
        toValue: 0,
        duration: 80,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
      });
      animation.current.start(({ finished }) => {
        if (!finished || generation.current !== id) return;
        y.setValue(5);
        entering.current = true;
        rendered.current = next;
        setCurrent(next);
      });
    },
    [reduced, opacity, y, enter],
  );
  return {
    current,
    selected,
    navigate,
    style: { opacity, transform: [{ translateY: y }] },
  };
}
