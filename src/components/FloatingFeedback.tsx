import React, { useEffect, useRef, useId, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  feedbackSnapshot,
  subscribeFeedbackView,
  registerFeedbackHost,
  dismissFeedback,
} from "../data/feedback";
import { AppIcon } from "./AppIcon";
import { useTheme } from "./theme";
export function FloatingFeedback({
  active = true,
  modal = false,
}: {
  active?: boolean;
  modal?: boolean;
}) {
  const { styles } = useTheme(),
    insets = useSafeAreaInsets(),
    id = useId();
  const snapshot = useSyncExternalStore(
    subscribeFeedbackView,
    feedbackSnapshot,
    feedbackSnapshot,
  );
  const current = snapshot.host === id ? snapshot.messages[0] : undefined;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismiss = dismissFeedback;
  useEffect(() => {
    if (active) return registerFeedbackHost(id, modal ? 1 : 0);
  }, [id, active, modal]);
  useEffect(() => {
    if (!current) return;
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!live) return;
      opacity.setValue(reduced ? 1 : 0);
      if (!reduced)
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: false,
        }).start();
    });
    const timer = setTimeout(dismiss, current.kind === "error" ? 6500 : 4200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [current, opacity]);
  if (!current) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: insets.bottom + 88,
        left: 16,
        right: 16,
        zIndex: 9999,
        alignItems: "center",
      }}
    >
      <Animated.View
        pointerEvents="box-none"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          {
            opacity,
            maxWidth: 540,
            width: "100%",
            padding: 14,
            borderWidth: 1,
            borderRadius: 18,
            borderColor:
              current.kind === "error" ? styles.error.color : styles.link.color,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            elevation: 12,
            boxShadow: "0 4px 20px #0003",
          },
        ]}
      >
        <Text
          pointerEvents="none"
          style={[styles.body, { flex: 1, color: styles.cardTitle.color }]}
        >{`${current.kind === "success" ? "✓" : current.kind === "error" ? "!" : "i"} ${current.message}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar notificación"
          onPress={dismiss}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppIcon name="close" size={18} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
