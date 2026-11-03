import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  View,
} from "react-native";
import { AppIcon } from "./AppIcon";
import { useTheme } from "./theme";
export function SettingsToggle({
  open,
  onPress,
  kind = "settings",
}: {
  open: boolean;
  onPress: () => void;
  kind?: "settings" | "profile";
}) {
  const { styles, colors } = useTheme(),
    progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      if (reduce) progress.setValue(open ? 1 : 0);
      else
        Animated.timing(progress, {
          toValue: open ? 1 : 0,
          duration: 180,
          useNativeDriver: Platform.OS !== "web",
        }).start();
    });
    return () => {
      live = false;
      progress.stopAnimation();
    };
  }, [open, progress]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        kind === "profile"
          ? open
            ? "Cerrar perfil"
            : "Abrir perfil"
          : open
            ? "Cerrar ajustes"
            : "Abrir ajustes"
      }
      aria-expanded={open}
      onPress={onPress}
      style={styles.iconButton}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: open ? colors.soft : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "45deg"],
                }),
              },
            ],
          }}
        >
          <AppIcon name={kind === "profile" ? "user" : "settings"} size={21} />
        </Animated.View>
        <Animated.View
          style={{
            opacity: progress,
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-45deg", "0deg"],
                }),
              },
            ],
          }}
        >
          <AppIcon name="close" size={21} />
        </Animated.View>
      </View>
    </Pressable>
  );
}
