import React, { forwardRef, useRef, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable as NativePressable,
  type PressableProps,
} from "react-native";
import { useReducedMotion } from "./motion";
const AnimatedButton = Animated.createAnimatedComponent(NativePressable);
/** Small, shared press response; actions and accessibility stay with RN Pressable. */
export const Pressable = forwardRef<
  React.ElementRef<typeof NativePressable>,
  PressableProps
>(function Pressable(
  { style, onPressIn, onPressOut, disabled, ...props },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (reduced || disabled) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [reduced, disabled, scale]);
  const animate = (value: number) => {
    scale.stopAnimation();
    if (reduced || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: value,
      duration: value === 1 ? 150 : 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };
  return (
    <AnimatedButton
      {...props}
      ref={ref}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        animate(0.975);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        animate(1);
        onPressOut?.(e);
      }}
      style={[
        typeof style === "function" ? style({ pressed }) : style,
        { transform: [{ scale }] },
      ]}
    />
  );
});
