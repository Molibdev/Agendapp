import { Text, View } from "react-native";
import { AppIcon, type IconName } from "./AppIcon";
import { useTheme } from "./theme";
const visuals: Record<string, { icon: IconName; light: string; dark: string }> =
  {
    food: { icon: "food", light: "#9a3c0c", dark: "#ffb27e" },
    home: { icon: "home", light: "#7e5b06", dark: "#f4d166" },
    transport: { icon: "transport", light: "#04647d", dark: "#79d9f0" },
    health: { icon: "health", light: "#a8324d", dark: "#ffa3b8" },
    leisure: { icon: "leisure", light: "#7b32ac", dark: "#d7a1ff" },
    salary: { icon: "income", light: "#126341", dark: "#75dda9" },
  };
export function categoryVisual(id: string) {
  return (
    visuals[id] ?? {
      icon: "tag" as const,
      light: ["#7b32ac", "#04647d", "#126341", "#9a3c0c"][
        Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0) % 4
      ],
      dark: ["#d7a1ff", "#79d9f0", "#75dda9", "#ffb27e"][
        Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0) % 4
      ],
    }
  );
}
export function CategoryTag({
  id,
  name,
  small = false,
}: {
  id: string;
  name: string;
  small?: boolean;
}) {
  const { styles, dark } = useTheme(),
    v = categoryVisual(id),
    color = dark ? v.dark : v.light;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 18,
        backgroundColor: color + (dark ? "27" : "16"),
        alignSelf: "flex-start",
        maxWidth: "100%",
      }}
    >
      <AppIcon name={v.icon} size={small ? 11 : 13} color={color} />
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { fontSize: 11, lineHeight: 15, color, flexShrink: 1 },
        ]}
      >
        {name}
      </Text>
    </View>
  );
}
