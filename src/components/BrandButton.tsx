import { Pressable } from "./Pressable";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  Platform,
  type GestureResponderEvent,
} from "react-native";
import { APP_ABOUT } from "../data/appInfo";
import { notify } from "../data/feedback";
import { useTheme } from "./theme";
export function BrandButton() {
  const { dark } = useTheme(),
    last = useRef<number | null>(null),
    [reader, setReader] = useState(false);
  useEffect(() => {
    // React Native Web reports true unconditionally; use keyboard activation there.
    if (Platform.OS === "web") return;
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (live) setReader(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setReader,
    );
    return () => {
      live = false;
      listener.remove();
    };
  }, []);
  const show = () => {
    last.current = null;
    notify(APP_ABOUT, "info", undefined, 6500);
  };
  const press = (e: GestureResponderEvent) => {
    if (
      reader ||
      (Platform.OS === "web" &&
        (("detail" in e.nativeEvent && e.nativeEvent.detail === 0) ||
          ("key" in e.nativeEvent &&
            (e.nativeEvent.key === "Enter" || e.nativeEvent.key === " "))))
    ) {
      show();
      return;
    }
    const now = Date.now(),
      previous = last.current;
    if (previous !== null && now - previous >= 0 && now - previous <= 350)
      show();
    else last.current = now;
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Información de Agendapp"
      accessibilityHint="Toca dos veces para ver créditos y versión"
      accessibilityActions={[
        { name: "activate", label: "Mostrar créditos y versión" },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "activate") show();
      }}
      onPress={press}
      onLongPress={show}
      style={{ minWidth: 160, minHeight: 44, justifyContent: "center" }}
    >
      <Image
        testID="brand-image"
        accessible={false}
        source={
          dark
            ? require("../../assets/brand/logo-dark.png")
            : require("../../assets/brand/logo-light.png")
        }
        style={{ width: 160, height: 40 }}
        resizeMode="contain"
      />
    </Pressable>
  );
}
