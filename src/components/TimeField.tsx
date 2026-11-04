import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "./theme";
export type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};
/** Browser delegates to its native time control; native implementation uses Android's clock. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const { styles, dark } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      {React.createElement("input", {
        type: "time",
        "aria-label": label,
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value),
        style: {
          border: `1px solid ${styles.input.borderColor}`,
          borderRadius: 14,
          padding: 12,
          minHeight: 48,
          boxSizing: "border-box",
          width: "100%",
          font: "inherit",
          color: styles.input.color,
          background: styles.input.backgroundColor,
          colorScheme: dark ? "dark" : "light",
        },
      })}
    </View>
  );
}
