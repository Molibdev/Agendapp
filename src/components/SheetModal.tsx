import { useAppLock } from "./AppLock";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useReducedMotion } from "./motion";
/** Keep the last panel mounted through exit; dim only after its entry completes. */
export function SheetModal({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const lock = useAppLock();
  const allowed = lock.loaded && (!lock.enabled || lock.unlocked);
  const [present, setPresent] = useState(visible);
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const lift = useRef(new Animated.Value(visible ? height : 0)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const last = useRef(children);
  if (visible) last.current = children;
  const generation = useRef(0);
  const options = useRef({ height, reduced });
  options.current = { height, reduced };
  const running = useRef<Animated.CompositeAnimation | undefined>(undefined);
  useEffect(() => {
    const id = ++generation.current;
    const reduced = options.current.reduced;
    const height = Math.max(
      options.current.height,
      Dimensions.get("screen").height,
    );
    const native = Platform.OS !== "web";
    let motion: Animated.CompositeAnimation | undefined;
    if (visible) {
      setPresent(true);
      dim.setValue(0);
      lift.setValue(reduced ? 0 : height);
      motion = Animated.sequence([
        Animated.timing(lift, {
          toValue: 0,
          duration: reduced ? 0 : 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: native,
        }),
        Animated.timing(dim, {
          toValue: 1,
          duration: reduced ? 0 : 140,
          useNativeDriver: native,
        }),
      ]);
      running.current = motion;
      motion.start();
    } else {
      Keyboard.dismiss();
      motion = Animated.parallel([
        Animated.timing(dim, {
          toValue: 0,
          duration: reduced ? 0 : 90,
          useNativeDriver: native,
        }),
        Animated.timing(lift, {
          toValue: height,
          duration: reduced ? 0 : 170,
          easing: Easing.in(Easing.quad),
          useNativeDriver: native,
        }),
      ]);
      running.current = motion;
      motion.start(({ finished }) => {
        if (finished && generation.current === id) setPresent(false);
      });
    }
    return () => {
      generation.current++;
      motion?.stop();
    };
  }, [visible, lift, dim]);
  useEffect(() => {
    if (!reduced) return;
    generation.current++;
    running.current?.stop();
    lift.setValue(0);
    dim.setValue(visible ? 1 : 0);
    setPresent(visible);
  }, [reduced, visible, lift, dim]);
  return (
    <Modal
      visible={present && allowed}
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <Animated.View
        testID="sheet-backdrop"
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(5,3,12,0.28)", opacity: dim },
        ]}
      />
      <Animated.View
        testID="sheet-motion"
        pointerEvents={visible ? "auto" : "none"}
        style={{ flex: 1, transform: [{ translateY: lift }] }}
      >
        {visible ? children : last.current}
      </Animated.View>
    </Modal>
  );
}
