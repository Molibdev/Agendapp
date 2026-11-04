import React, { useState } from "react";
import { Keyboard, Platform, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Pressable } from "./Pressable";
import { useTheme } from "./theme";
import { AppIcon } from "./AppIcon";
type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};
export function TimeField({ label, value, onChange }: Props) {
  const { styles, dark } = useTheme(),
    [visible, setVisible] = useState(false);
  const date = new Date();
  const [h, m] = value.split(":").map(Number);
  date.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  const change = (d: Date) =>
    onChange(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          Keyboard.dismiss();
          if (Platform.OS === "android")
            DateTimePickerAndroid.open({
              value: date,
              mode: "time",
              display: "clock",
              is24Hour: true,
              onChange: (e, d) => {
                if (e.type === "set" && d) change(d);
              },
            });
          else setVisible(!visible);
        }}
        style={[
          styles.input,
          { flexDirection: "row", alignItems: "center", gap: 8 },
        ]}
      >
        <AppIcon name="clock" size={17} color={styles.link.color} />
        <Text style={styles.body}>{value}</Text>
      </Pressable>
      {visible && Platform.OS === "ios" && (
        <DateTimePicker
          value={date}
          mode="time"
          display="spinner"
          themeVariant={dark ? "dark" : "light"}
          onChange={(_, d) => {
            if (d) change(d);
          }}
        />
      )}
    </View>
  );
}
