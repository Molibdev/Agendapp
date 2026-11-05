import { Pressable } from "./Pressable";
import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { AppIcon } from "./AppIcon";
import { useReducedMotion } from "./motion";
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
    reduced = useReducedMotion(),
    progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(open ? 1 : 0);
      return;
    }
    const motion = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 100,
      isInteraction: false,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
    });
    motion.start();
    return () => motion.stop();
  }, [open, progress, reduced]);
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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.soft,
            opacity: progress,
          }}
        />
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
                  outputRange: ["0deg", "25deg"],
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
                  outputRange: ["-25deg", "0deg"],
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
