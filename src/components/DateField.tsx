import { Sheet } from "./Sheet";
import { Pressable } from "./Pressable";
import React, { useState, createContext, useContext } from "react";
import { Text, TextInput, View, Keyboard } from "react-native";
import { AppIcon } from "./AppIcon";
import { useTheme } from "./theme";
import { dateSchema, today } from "../domain/finance";
type Request = {
  compact?: boolean;
  label: string;
  value: string;
  onChange: (v: string) => void;
  monthOnly?: boolean;
  dayOnly?: boolean;
};
const CalendarContext = createContext<{
  request: Request | null;
  show: (r: Request) => void;
  close: () => void;
}>({ request: null, show: () => {}, close: () => {} });
export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  return (
    <CalendarContext.Provider
      value={{ request, show: setRequest, close: () => setRequest(null) }}
    >
      {children}
    </CalendarContext.Provider>
  );
}
export const useCalendar = () => useContext(CalendarContext);
export function DateField(props: Request) {
  const { styles } = useTheme(),
    calendar = useCalendar();
  const {
    value,
    label,
    monthOnly = false,
    dayOnly = false,
    compact = false,
  } = props;
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const formatted = dayOnly
    ? `Día ${value} de cada mes`
    : monthOnly
      ? `${months[Number(value.slice(5, 7)) - 1] ?? ""} ${value.slice(0, 4)}`
      : dateSchema.safeParse(value).success
        ? value.split("-").reverse().join(" / ")
        : "Seleccionar fecha";
  return (
    <View style={{ gap: 7 }}>
      {!compact && <Text style={styles.label}>{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          Keyboard.dismiss();
          calendar.show(props);
        }}
        style={[
          styles.input,
          { flexDirection: "row", alignItems: "center", gap: 8 },
          compact && {
            minHeight: 44,
            paddingVertical: 9,
            paddingHorizontal: 12,
            borderRadius: 14,
          },
        ]}
      >
        <AppIcon
          name="calendar"
          size={compact ? 15 : 17}
          color={styles.link.color}
        />
        <Text
          style={[
            styles.body,
            { color: styles.input.color, fontSize: compact ? 12 : 15 },
          ]}
        >
          {compact && monthOnly
            ? `${months[Number(value.slice(5, 7)) - 1]?.slice(0, 3)} ${value.slice(0, 4)}`
            : formatted}
        </Text>
      </Pressable>
    </View>
  );
}
export function CalendarContent() {
  const { styles } = useTheme();
  const { request, close } = useCalendar();
  const {
    label,
    value,
    onChange,
    monthOnly = false,
    dayOnly = false,
  } = request!;
  const [cursor, setCursor] = useState(
      value.length >= 7 ? value.slice(0, 7) : today().slice(0, 7),
    ),
    [year, setYear] = useState(
      (value.length >= 7 ? value : today()).slice(0, 4),
    );
  const y = Number(cursor.slice(0, 4)) || new Date().getFullYear(),
    m = Number(cursor.slice(5, 7)) || 1;
  const move = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) return;
    setCursor(d.toISOString().slice(0, 7));
    setYear(String(d.getUTCFullYear()));
  };
  const validYear =
    /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 2100;
  const days = dayOnly ? 31 : new Date(Date.UTC(y, m, 0)).getUTCDate(),
    offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const formatted = dayOnly
    ? `Día ${value} de cada mes`
    : monthOnly
      ? `${monthNames[Number(value.slice(5, 7)) - 1] ?? ""} ${value.slice(0, 4)}`
      : dateSchema.safeParse(value).success
        ? value.split("-").reverse().join(" / ")
        : "Seleccionar fecha";
  const select = (v: string) => {
    onChange(v);
    close();
  };
  const button = (text: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={action}
      style={styles.chip}
    >
      <Text style={styles.cardTitle}>
        {text === "Mes anterior" ? "‹" : text === "Mes siguiente" ? "›" : text}
      </Text>
    </Pressable>
  );
  return (
    <Sheet onClose={close} maxWidth={440}>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={styles.section}>
        {dayOnly
          ? "Día de facturación"
          : monthOnly
            ? "Seleccionar mes"
            : "Seleccionar fecha"}
      </Text>
      <Text style={styles.body}>{formatted}</Text>
      {!dayOnly && (
        <View style={[styles.row, { alignItems: "center" }]}>
          {button("Mes anterior", () => move(-1))}
          <Text style={styles.cardTitle}>{monthNames[m - 1]}</Text>
          {button("Mes siguiente", () => move(1))}
        </View>
      )}
      {!dayOnly && (
        <View style={[styles.row, { alignItems: "center" }]}>
          <Text style={styles.label}>Año</Text>
          <TextInput
            accessibilityLabel="Año del calendario"
            value={year}
            keyboardType="number-pad"
            maxLength={4}
            style={[styles.input, { width: 100 }]}
            onChangeText={(v) => {
              setYear(v);
              if (/^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100)
                setCursor(`${v}-${String(m).padStart(2, "0")}`);
            }}
          />
        </View>
      )}
      {!dayOnly && !validYear && (
        <Text style={styles.error}>Introduce un año entre 1900 y 2100.</Text>
      )}
      {monthOnly ? (
        <View style={styles.wrap}>
          {monthNames.map((name, i) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${name} ${y}`}
              key={name}
              disabled={!validYear}
              accessibilityState={{
                selected: `${y}-${String(i + 1).padStart(2, "0")}` === value,
              }}
              aria-selected={`${y}-${String(i + 1).padStart(2, "0")}` === value}
              style={[
                styles.chip,
                { width: "30%", alignItems: "center", minHeight: 48 },
                `${y}-${String(i + 1).padStart(2, "0")}` === value &&
                  styles.chipSelected,
              ]}
              onPress={() => select(`${y}-${String(i + 1).padStart(2, "0")}`)}
            >
              <Text
                style={[
                  styles.cardTitle,
                  `${y}-${String(i + 1).padStart(2, "0")}` === value && {
                    color: "#fff",
                  },
                ]}
              >
                {name.slice(0, 3)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          {!dayOnly && (
            <View style={{ flexDirection: "row" }}>
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.muted,
                    { width: "14.28%", textAlign: "center" },
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: (dayOnly ? 0 : offset) + days }, (_, i) => {
              const day = i - (dayOnly ? 0 : offset) + 1,
                iso = `${cursor}-${String(day).padStart(2, "0")}`;
              return day < 1 ? (
                <View key={i} style={{ width: "14.28%" }} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={dayOnly ? `Día ${day}` : iso}
                  accessibilityState={{
                    selected: dayOnly ? String(day) === value : iso === value,
                  }}
                  aria-selected={
                    dayOnly ? String(day) === value : iso === value
                  }
                  key={i}
                  disabled={!dayOnly && !validYear}
                  onPress={() => select(dayOnly ? String(day) : iso)}
                  style={{
                    width: "14.28%",
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 16,
                    borderWidth: iso === today() && !dayOnly ? 2 : 0,
                    borderColor: styles.link.color,
                    backgroundColor: (
                      dayOnly ? String(day) === value : iso === value
                    )
                      ? styles.button.backgroundColor
                      : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: (dayOnly ? String(day) === value : iso === value)
                        ? "#fff"
                        : styles.cardTitle.color,
                      fontWeight: "600",
                    }}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <View style={styles.wrap}>
        {!dayOnly &&
          button("Hoy", () =>
            select(monthOnly ? today().slice(0, 7) : today()),
          )}
        {button("Cerrar calendario", () => close())}
      </View>
    </Sheet>
  );
}
