import React, { useRef, useEffect, type ReactNode } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "./Pressable";
import { useTheme } from "./theme";
import { useReducedMotion } from "./motion";
/** Handle-only drag keeps scrolling and text selection independent of dismissal. */
export function Sheet({
  children,
  onClose,
  disabled = false,
  maxWidth = 640,
}: {
  children: ReactNode;
  onClose: () => void;
  disabled?: boolean;
  maxWidth?: number;
}) {
  const { styles, colors } = useTheme(),
    insets = useSafeAreaInsets(),
    { height } = useWindowDimensions();
  const y = useRef(new Animated.Value(0)).current,
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const reduced = useReducedMotion();
  const current = useRef({ onClose, disabled });
  current.current = { onClose, disabled };
  const reset = () => {
    if (reduced) y.setValue(0);
    else
      Animated.spring(y, {
        toValue: 0,
        useNativeDriver: Platform.OS !== "web",
        damping: 24,
        stiffness: 260,
        mass: 1,
      }).start();
  };
  const reveal = () => {
    if (Platform.OS !== "web") {
      const input = TextInput.State.currentlyFocusedInput();
      if (input)
        scroll.current?.scrollResponderScrollNativeHandleToKeyboard(
          input,
          24,
          true,
        );
    }
  };
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    const listener = Keyboard.addListener("keyboardDidShow", reveal);
    return () => {
      listener.remove();
      clearTimeout(focusTimer.current);
    };
  }, []);
  const dragged = useRef(false);
  const pan = PanResponder.create({
    onStartShouldSetPanResponderCapture: () => {
      dragged.current = false;
      return false;
    },
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => {
      const capture =
        !current.current.disabled &&
        g.dy > 5 &&
        Math.abs(g.dy) > Math.abs(g.dx);
      if (capture) dragged.current = true;
      return capture;
    },
    onMoveShouldSetPanResponder: (_, g) =>
      !current.current.disabled && g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (
        !current.current.disabled &&
        (g.dy > Math.min(120, height * 0.16) || (g.dy > 36 && g.vy > 0.8))
      ) {
        Keyboard.dismiss();
        current.current.onClose();
        return;
      }
      reset();
    },
    onPanResponderTerminate: reset,
  });
  return (
    <KeyboardAvoidingView
      testID="sheet-overlay"
      style={[
        styles.overlay,
        { paddingTop: insets.top + 12, backgroundColor: "transparent" },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Animated.View
        testID="sheet-panel"
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            maxWidth,
            maxHeight: "100%",
            paddingBottom: Math.max(16, insets.bottom + 12),
            transform: [{ translateY: y }],
          },
        ]}
      >
        <View
          {...pan.panHandlers}
          style={
            Platform.OS === "web"
              ? ({ touchAction: "none" } as React.ComponentProps<
                  typeof View
                >["style"])
              : undefined
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú emergente"
            disabled={disabled}
            accessibilityActions={[
              { name: "activate", label: "Cerrar menú emergente" },
            ]}
            onAccessibilityAction={() => {
              if (disabled) return;
              Keyboard.dismiss();
              onClose();
            }}
            onPress={(event) => {
              const keyboard =
                Platform.OS === "web" &&
                "detail" in event.nativeEvent &&
                event.nativeEvent.detail === 0;
              if (dragged.current && !keyboard) return;
              Keyboard.dismiss();
              onClose();
            }}
            style={{
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 4,
                backgroundColor: colors.muted,
                opacity: 0.5,
              }}
            />
          </Pressable>
        </View>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          onFocusCapture={() => {
            clearTimeout(focusTimer.current);
            focusTimer.current = setTimeout(reveal, 180);
          }}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 4,
            paddingBottom: 16,
            gap: 18,
          }}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
