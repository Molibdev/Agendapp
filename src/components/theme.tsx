import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DOCK_HEIGHT, DOCK_MARGIN } from "./layout";
import { useFonts } from "expo-font";

export const themeColors = (dark: boolean) =>
  dark
    ? {
        bg: "#0d0c13",
        surface: "#211e2b",
        raised: "#2b2637",
        text: "#f5f2fc",
        muted: "#b5aec4",
        border: "#443c55",
        soft: "#30273e",
        accent: "#c3a4ff",
        primary: "#7842d6",
        positive: "#6ee7a8",
        negative: "#ff9a9e",
        input: "#19161f",
        hero: "#221b32",
        heroText: "#f5f2fc",
        header: "#0d0c13",
      }
    : {
        bg: "#f3f2f7",
        surface: "#ffffff",
        raised: "#faf8ff",
        text: "#251d34",
        muted: "#6c627b",
        border: "#d7d1e1",
        soft: "#eee7fa",
        accent: "#7132c3",
        primary: "#7132c3",
        positive: "#11764a",
        negative: "#b6374b",
        input: "#faf8fd",
        hero: "#eee5fc",
        heroText: "#2f174f",
        header: "#ffffff",
      };
function build(dark: boolean, fonts: boolean) {
  const c = themeColors(dark);
  const font = (weight = 400) =>
    fonts
      ? `Inter_${weight}${({ 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold" } as Record<number, string>)[weight]}`
      : Platform.select({
          android: "sans-serif",
          ios: "System",
          default: "system-ui, sans-serif",
        });
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    shell: { flex: 1, width: "100%", maxWidth: 1160, alignSelf: "center" },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      gap: 16,
      backgroundColor: c.bg,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.header,
    },
    logo: {
      fontSize: 21,
      fontFamily: font(700),
      fontWeight: "700",
      letterSpacing: -0.9,
      color: c.text,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 100,
      gap: 22,
    },
    pageTitle: {
      fontSize: 28,
      fontFamily: font(700),
      fontWeight: "700",
      letterSpacing: -1,
      color: c.text,
    },
    pageCaption: {
      fontSize: 13,
      fontFamily: font(),
      lineHeight: 20,
      color: c.muted,
    },
    muted: { fontSize: 12, fontFamily: font(), color: c.muted, lineHeight: 19 },
    body: { fontSize: 14, fontFamily: font(), color: c.muted, lineHeight: 22 },
    eyebrow: {
      fontSize: 11,
      fontFamily: font(600),
      color: c.muted,
      fontWeight: "600",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    section: {
      fontSize: 19,
      fontFamily: font(600),
      fontWeight: "600",
      letterSpacing: -0.5,
      color: c.text,
    },
    sectionHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
      flexWrap: "wrap",
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      gap: 14,
    },
    cardTitle: {
      fontSize: 15,
      fontFamily: font(600),
      fontWeight: "600",
      color: c.text,
      lineHeight: 22,
    },
    hero: {
      backgroundColor: c.hero,
      padding: 24,
      borderRadius: 26,
      gap: 10,
      borderWidth: 1,
      borderColor: dark ? "#493760" : "#d7c4f1",
      overflow: "hidden",
    },
    heroLabel: {
      fontSize: 12,
      fontFamily: font(500),
      color: c.heroText,
      lineHeight: 19,
    },
    heroAmount: {
      fontSize: 38,
      fontFamily: font(700),
      fontWeight: "700",
      letterSpacing: -1.7,
      color: c.heroText,
    },
    heroCaption: {
      fontSize: 11,
      fontFamily: font(),
      color: dark ? "#c2afdc" : "#735c90",
      lineHeight: 18,
    },
    heroStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderColor: dark ? "#493760" : "#d7c4f1",
      marginTop: 10,
      paddingTop: 16,
      gap: 16,
    },
    heroSmall: {
      fontSize: 21,
      fontFamily: font(600),
      fontWeight: "600",
      color: c.heroText,
      marginTop: 6,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 14,
      minHeight: 46,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    buttonText: {
      color: "#ffffff",
      fontSize: 13,
      fontFamily: font(600),
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 20,
    },
    secondary: { backgroundColor: c.soft },
    link: {
      fontSize: 13,
      fontFamily: font(600),
      color: c.accent,
      fontWeight: "600",
    },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
    track: {
      height: 6,
      backgroundColor: c.soft,
      borderRadius: 6,
      overflow: "hidden",
    },
    fill: { height: 6, backgroundColor: c.accent, borderRadius: 6 },
    empty: {
      fontSize: 14,
      fontFamily: font(),
      lineHeight: 23,
      color: c.muted,
      paddingVertical: 20,
    },
    activity: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderColor: c.border,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    accountAmount: {
      fontSize: 26,
      fontFamily: font(600),
      fontWeight: "600",
      letterSpacing: -0.7,
      color: c.text,
    },
    nav: {
      height: DOCK_HEIGHT,
      marginHorizontal: 18,
      marginBottom: DOCK_MARGIN,
      padding: 8,
      flexDirection: "row",
      flexShrink: 0,
      gap: 4,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 24,
    },
    navItem: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
    },
    navActive: { backgroundColor: c.primary },
    navLabel: {
      fontSize: 13,
      fontFamily: font(500),
      fontWeight: "500",
      color: c.muted,
    },
    footer: {
      fontSize: 10,
      fontFamily: font(500),
      letterSpacing: 1.4,
      color: c.muted,
      textAlign: "center",
      marginTop: 16,
      marginBottom: 6,
    },
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(5,3,12,0.72)",
    },
    sheet: {
      width: "100%",
      maxWidth: 640,
      maxHeight: "93%",
      alignSelf: "center",
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: c.border,
    },
    label: {
      fontSize: 12,
      fontFamily: font(600),
      fontWeight: "600",
      color: c.text,
      lineHeight: 19,
    },
    input: {
      borderWidth: 1,
      borderColor: dark ? "#786787" : "#8e7e9f",
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 48,
      borderRadius: 13,
      fontSize: 15,
      fontFamily: font(),
      backgroundColor: c.input,
      color: c.text,
    },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.soft,
      borderRadius: 12,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: "center",
    },
    chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    error: {
      color: c.negative,
      fontSize: 13,
      fontFamily: font(),
      lineHeight: 21,
    },
    localBadge: { backgroundColor: c.soft, padding: 10, borderRadius: 12 },
    month: {
      backgroundColor: c.soft,
      padding: 10,
      borderRadius: 12,
      width: 100,
      textAlign: "center",
      fontSize: 13,
      fontFamily: font(),
      color: c.text,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    profileCard: { padding: 15, gap: 10, borderRadius: 20 },
    profileTitle: { fontSize: 17, lineHeight: 23 },
    profileBody: { fontSize: 13, lineHeight: 20 },
    profileButton: {
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 13,
      borderRadius: 12,
    },
    profileGap: { gap: 16 },
    chartAmount: {
      fontSize: 30,
      fontFamily: font(700),
      fontWeight: "700",
      color: c.text,
      letterSpacing: -1,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      alignSelf: "flex-start",
    },
  });
}
const ThemeContext = createContext({
  styles: build(false, false),
  colors: themeColors(false),
  dark: false,
  toggle: () => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme(),
    [choice, setChoice] = useState<string | null>(null);
  const [fonts] = useFonts({
    Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
    Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
  });
  useEffect(() => {
    void AsyncStorage.getItem("qgasto:theme")
      .then(setChoice)
      .catch(() => {});
  }, []);
  const dark = choice ? choice === "dark" : system === "dark";
  const styles = useMemo(() => build(dark, fonts), [dark, fonts]);
  return (
    <ThemeContext.Provider
      value={{
        styles,
        colors: themeColors(dark),
        dark,
        toggle: () => {
          const next = dark ? "light" : "dark";
          setChoice(next);
          void AsyncStorage.setItem("qgasto:theme", next).catch(() => {});
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
