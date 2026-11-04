import { Pressable } from "./Pressable";
import { useEffect, useId, useState } from "react";
import { Text, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Line,
  Circle,
} from "react-native-svg";
import { State, clp, spent } from "../domain/finance";
import { spendingSeries } from "../domain/insights";
import { useTheme } from "./theme";
import { AppIcon } from "./AppIcon";
import { categoryVisual } from "./CategoryTag";

export function SpendingCard({
  state,
  month,
}: {
  state: State;
  month: string;
}) {
  const { styles, colors, dark } = useTheme(),
    series = spendingSeries(state, month);
  const [selected, setSelected] = useState<number | null>(null),
    [chartWidth, setChartWidth] = useState(320),
    id = useId().replace(/:/g, "");
  useEffect(() => setSelected(null), [month]);
  const width = chartWidth,
    height = 130,
    max = Math.max(1, series.total),
    n = series.points.length;
  const coord = (i: number) => ({
    x: 10 + (i / (n - 1)) * Math.max(1, width - 20),
    y: height - 12 - (series.points[i].cumulative / max) * (height - 28),
  });
  const path = series.points
    .map((_, i) => `${i ? "L" : "M"}${coord(i).x},${coord(i).y}`)
    .join(" ");
  const selectedDay = selected === null ? null : Math.min(n - 1, selected);
  const point = coord(selectedDay ?? n - 1);
  return (
    <View style={styles.card}>
      <View style={[styles.row, { alignItems: "center" }]}>
        <Text style={styles.eyebrow}>Ritmo de gastos</Text>
        <AppIcon name="activity" color={colors.accent} size={18} />
      </View>
      <View style={[styles.row, { alignItems: "center", flexWrap: "wrap" }]}>
        <Text style={styles.chartAmount}>{clp(series.total)}</Text>
        <View style={[styles.badge, { backgroundColor: colors.soft }]}>
          <Text style={[styles.label, { color: colors.accent, fontSize: 10 }]}>
            ACUMULADO DEL MES
          </Text>
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.muted}>
        {selectedDay === null
          ? `${series.count} movimientos de gasto · toca el gráfico para explorar`
          : `Día ${selectedDay + 1} · ${clp(series.points[selectedDay].cumulative)} acumulados · ${clp(series.points[selectedDay].amount)} ese día`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Explorar gastos acumulados"
        accessibilityHint="Toca para consultar un día; con lector de pantalla avanza un día por pulsación"
        onPress={(e) => {
          const x = e.nativeEvent.locationX;
          setSelected(
            Number.isFinite(x) && x > 0
              ? Math.min(
                  n - 1,
                  Math.max(
                    0,
                    Math.round(((x - 10) / Math.max(1, width - 20)) * (n - 1)),
                  ),
                )
              : ((selected ?? -1) + 1) % n,
          );
        }}
        onLayout={(e) => setChartWidth(Math.max(1, e.nativeEvent.layout.width))}
        style={{ height: 150 }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          pointerEvents="none"
          accessible={false}
        >
          <Defs>
            <LinearGradient
              id={`line${id}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={width}
              y2="0"
            >
              <Stop offset="0" stopColor="#fd9d46" />
              <Stop offset="0.5" stopColor={dark ? "#bc8cff" : "#8b4dd9"} />
              <Stop offset="1" stopColor={dark ? "#76e8b0" : "#16845b"} />
            </LinearGradient>
            <LinearGradient id={`area${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity="0.16" />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {[25, 65, 105].map((y) => (
            <Line
              key={y}
              x1="10"
              x2={width - 10}
              y1={y}
              y2={y}
              stroke={colors.border}
              strokeDasharray="3 6"
              strokeOpacity="0.65"
            />
          ))}
          <Path
            d={`${path} L${width - 10},${height} L10,${height} Z`}
            fill={`url(#area${id})`}
          />
          <Path
            d={path}
            fill="none"
            stroke={`url(#line${id})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {series.total > 0 && (
            <>
              <Line
                x1={point.x}
                x2={point.x}
                y1="8"
                y2="126"
                stroke={colors.accent}
                strokeDasharray="3 5"
                opacity={selected === null ? 0 : 0.6}
              />
              <Circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill={colors.surface}
                stroke={selected === null ? colors.positive : colors.accent}
                strokeWidth="3"
              />
            </>
          )}
        </Svg>
      </Pressable>
      <View style={styles.row}>
        <Text style={styles.muted}>01</Text>
        <Text style={styles.muted}>Días del mes · datos registrados</Text>
        <Text style={styles.muted}>{series.days}</Text>
      </View>
    </View>
  );
}
export function CategoryBreakdown({
  state,
  month,
}: {
  state: State;
  month: string;
}) {
  const { styles, dark } = useTheme();
  const categories = state.categories
    .filter((c) => c.type === "expense")
    .map((c) => ({ ...c, total: spent(state, c.id, month) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const total = categories.reduce((sum, c) => sum + c.total, 0);
  if (!categories.length) return null;
  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <Text style={styles.section}>En qué estás gastando</Text>
        <AppIcon name="tag" size={18} />
      </View>
      {categories.map((c) => {
        const visual = categoryVisual(c.id),
          color = dark ? visual.dark : visual.light;
        return (
          <View
            key={c.id}
            style={{
              position: "relative",
              borderRadius: 15,
              overflow: "hidden",
              paddingVertical: 13,
              paddingHorizontal: 12,
            }}
          >
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.max(8, (c.total / total) * 100)}%`,
                backgroundColor: color + (dark ? "2b" : "1b"),
                borderRadius: 15,
              }}
            />
            <View style={[styles.row, { alignItems: "center" }]}>
              <View
                style={{
                  flexDirection: "row",
                  gap: 9,
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <AppIcon name={visual.icon} size={17} color={color} />
                <Text
                  style={[styles.cardTitle, { flexShrink: 1, fontSize: 13 }]}
                >
                  {c.name}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={[styles.cardTitle, { fontSize: 13 }]}>
                  {clp(c.total)}
                </Text>
                <Text style={[styles.muted, { fontSize: 10 }]}>
                  {Math.round((c.total / total) * 100)}%
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
