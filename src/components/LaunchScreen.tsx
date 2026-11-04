import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { LAUNCH_BACKGROUND, LAUNCH_MAX_MS } from "../data/appInfo";
// Hand off the native frame as soon as the matching React frame has laid out.
if (Platform.OS !== "web")
  void SplashScreen.preventAutoHideAsync().catch(() => {});
export function LaunchScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const fade = useRef(new Animated.Value(1)).current,
    scale = useRef(new Animated.Value(1)).current,
    y = useRef(new Animated.Value(0)).current;
  const nameFade = useRef(new Animated.Value(0)).current,
    nameY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    let live = true,
      staticTimer: ReturnType<typeof setTimeout> | undefined;
    let motion: Animated.CompositeAnimation | undefined;
    const finish = () => {
      if (live) {
        live = false;
        motion?.stop();
        fade.setValue(0);
        setVisible(false);
      }
    };
    const deadline = setTimeout(finish, LAUNCH_MAX_MS);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!live) return;
        if (reduced) {
          nameFade.setValue(1);
          nameY.setValue(0);
          staticTimer = setTimeout(finish, 250);
          return;
        }
        const native = Platform.OS !== "web";
        motion = Animated.sequence([
          Animated.parallel([
            Animated.sequence([
              Animated.timing(scale, {
                toValue: 1.035,
                duration: 500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: native,
              }),
              Animated.timing(scale, {
                toValue: 1,
                duration: 400,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: native,
              }),
            ]),
            Animated.timing(y, {
              toValue: -24,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: native,
            }),
            Animated.sequence([
              Animated.delay(160),
              Animated.parallel([
                Animated.timing(nameFade, {
                  toValue: 1,
                  duration: 340,
                  useNativeDriver: native,
                }),
                Animated.timing(nameY, {
                  toValue: 0,
                  duration: 340,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: native,
                }),
              ]),
            ]),
          ]),
          Animated.delay(600),
          Animated.timing(fade, {
            toValue: 0,
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: native,
          }),
        ]);
        motion.start(({ finished }) => {
          if (finished) finish();
        });
      })
      .catch(finish);
    return () => {
      live = false;
      clearTimeout(deadline);
      clearTimeout(staticTimer);
      motion?.stop();
    };
  }, [fade, scale, y, nameFade, nameY]);
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={visible ? "none" : "auto"}
        accessibilityElementsHidden={visible}
        importantForAccessibility={visible ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {visible && (
        <Animated.View
          testID="launch-screen"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={() => {
            if (Platform.OS !== "web")
              void SplashScreen.hideAsync().catch(() => {});
          }}
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 10000,
              backgroundColor: LAUNCH_BACKGROUND,
              opacity: fade,
            },
          ]}
        >
          <StatusBar style="light" />
          <Animated.Image
            accessible={false}
            source={require("../../assets/splash-icon.png")}
            resizeMode="contain"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 112,
              height: 112,
              marginLeft: -56,
              marginTop: -56,
              transform: [{ translateY: y }, { scale }],
            }}
          />
          <Animated.Image
            accessible={false}
            source={require("../../assets/brand/wordmark-dark.png")}
            resizeMode="contain"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 216,
              height: 72,
              marginLeft: -108,
              marginTop: 42,
              opacity: nameFade,
              transform: [{ translateY: nameY }],
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}
