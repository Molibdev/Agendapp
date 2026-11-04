import { Pressable } from "./Pressable";
import { useState } from "react";
import { Text, View } from "react-native";
import licenses from "../../assets/licenses.json";
import { AppIcon } from "./AppIcon";
import { useTheme } from "./theme";
export function Licenses() {
  const { styles, colors } = useTheme(),
    [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Créditos y licencias"
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        style={[styles.row, { minHeight: 44, alignItems: "center" }]}
      >
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={styles.cardTitle}>Créditos y licencias</Text>
          <Text style={styles.muted}>Inter · Lucide Icons</Text>
        </View>
        <AppIcon
          name={open ? "down" : "right"}
          size={18}
          color={colors.accent}
        />
      </Pressable>
      {open &&
        Object.entries(licenses).map(([name, text]) => (
          <View key={name} style={{ gap: 8 }}>
            <Text style={styles.label}>{name}</Text>
            <Text style={[styles.muted, { fontSize: 11, lineHeight: 18 }]}>
              {text}
            </Text>
          </View>
        ))}
    </View>
  );
}
