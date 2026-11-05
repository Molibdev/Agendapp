import { SheetModal } from "./SheetModal";
import { TimeField } from "./TimeField";
import { Sheet } from "./Sheet";
import { Pressable } from "./Pressable";
import { FloatingFeedback } from "./FloatingFeedback";
import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  type Ref,
} from "react";
import {
  AppState,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { randomUUID } from "expo-crypto";
import { Command } from "../domain/finance";
import {
  AgendaEvent,
  AgendaView,
  agendaEventSchema,
  eventsOnDay,
  localDay,
  monthDays,
  shiftDay,
  shiftMonth,
  timelineEvents,
  weekStart,
} from "../domain/agenda";
import { CalendarContent, DateField, useCalendar } from "./DateField";
import { requestAgendaPermission } from "../data/agendaNotifications";
import { notify } from "../data/feedback";
import { AppIcon } from "./AppIcon";
import { useTheme } from "./theme";

const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-CL", options).format(new Date(`${day}T12:00:00`));
const timeLabel = (event: AgendaEvent) =>
  `${event.startsAt.slice(11)} – ${event.endsAt.slice(11)}`;

export type AgendaHandle = { create: () => void };
export function Agenda({
  createRef,
  events,
  save,
}: {
  createRef: Ref<AgendaHandle>;
  events: AgendaEvent[];
  save: (command: Command) => Promise<unknown>;
}) {
  const { styles } = useTheme(),
    { width } = useWindowDimensions();
  const calendar = useCalendar();
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState(() => localDay(new Date()));
  const [mode, setMode] = useState<AgendaView>("month");
  const [draft, setDraft] = useState<AgendaEvent | null>(null);
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const today = localDay(now),
    wide = width >= 760;
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 60000);
    const subscription = AppState.addEventListener("change", (s) => {
      if (s === "active") update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const button = (
    label: string,
    onPress: () => void,
    secondary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        { opacity: busy || disabled || pressed ? 0.6 : 1 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && { color: styles.cardTitle.color },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const open = (event?: AgendaEvent) => {
    setEditing(!!event);
    setError("");
    setConfirmDelete(false);
    setMessage("");
    setDraft(
      event
        ? { ...event }
        : {
            id: randomUUID(),
            title: "",
            startsAt: `${day}T09:00`,
            endsAt: `${day}T10:00`,
            location: "",
            description: "",
            remindDayBefore: false,
            remindSameDay: false,
          },
    );
  };
  const update = <K extends keyof AgendaEvent>(key: K, value: AgendaEvent[K]) =>
    setDraft((d) => d && { ...d, [key]: value });
  const commit = async (remove = false) => {
    if (!draft || busy) return;
    setError("");
    const parsed = agendaEventSchema.safeParse(draft);
    if (!remove && !parsed.success) {
      setError(
        !draft.title.trim()
          ? "Escribe un título para el evento."
          : draft.endsAt <= draft.startsAt
            ? "El fin debe ser posterior al inicio."
            : "Revisa las fechas, las horas (HH:mm) y la longitud de los campos.",
      );
      return;
    }
    setBusy(true);
    try {
      if (!remove && (draft.remindDayBefore || draft.remindSameDay)) {
        const granted = await requestAgendaPermission().catch(() => false);
        if (!granted)
          notify(
            "Las preferencias se guardarán, pero este dispositivo no tiene notificaciones de Agenda habilitadas.",
            "info",
          );
      }
      await save(
        remove
          ? { kind: "delete-event", id: draft.id }
          : {
              kind: editing ? "update-event" : "event",
              value: parsed.success ? parsed.data : draft,
            },
      );
      if (!remove) setDay(draft.startsAt.slice(0, 10));
      setDraft(null);
      setConfirmDelete(false);
      setMessage(remove ? "Evento eliminado" : "Evento guardado");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "No se pudo guardar el evento",
        "error",
      );
      setError(e instanceof Error ? e.message : "No se pudo guardar el evento");
    } finally {
      setBusy(false);
    }
  };
  const field = (
    label: string,
    key: "title" | "location" | "description",
    maxLength: number,
  ) => (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={draft![key]}
        onChangeText={(v) => update(key, v)}
        maxLength={maxLength}
        multiline={key === "description"}
        style={[
          styles.input,
          key === "description" && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
  useImperativeHandle(createRef, () => ({ create: () => open() }));
  const days =
    mode === "day"
      ? [day]
      : Array.from({ length: 7 }, (_, i) => shiftDay(weekStart(day), i));
  const previous =
    mode === "month"
      ? shiftMonth(day, -1)
      : shiftDay(day, mode === "week" ? -7 : -1);
  const next =
    mode === "month"
      ? shiftMonth(day, 1)
      : shiftDay(day, mode === "week" ? 7 : 1);
  const inBounds = (date: string) =>
    date >= "1900-01-01" && date <= "2100-12-31";
  return (
    <View style={{ gap: 18 }}>
      <View style={styles.sectionHead}>
        <View style={{ gap: 5, flexShrink: 1 }}>
          <Text style={styles.eyebrow}>TU AGENDA</Text>
          <Text style={styles.pageTitle}>
            {dateLabel(day, { month: "long", year: "numeric" }).replace(
              /^./,
              (c) => c.toUpperCase(),
            )}
          </Text>
        </View>
      </View>
      <View
        accessibilityLabel="Vista de la agenda"
        style={[
          styles.wrap,
          {
            backgroundColor: styles.secondary.backgroundColor,
            padding: 5,
            borderRadius: 24,
            flexWrap: "nowrap",
          },
        ]}
      >
        {(
          [
            ["month", "Mes"],
            ["week", "Semana"],
            ["day", "Día"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`Vista ${label.toLowerCase()}`}
            accessibilityState={{ selected: mode === value }}
            aria-selected={mode === value}
            onPress={() => setMode(value)}
            style={[
              styles.button,
              { flex: 1, paddingHorizontal: 8 },
              mode !== value && styles.secondary,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                mode !== value && { color: styles.cardTitle.color },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 12 }}>
        <View style={[styles.row, { alignItems: "center" }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Período anterior"
            disabled={!inBounds(previous)}
            onPress={() => setDay(previous)}
            style={[
              styles.chip,
              { width: 44, height: 44, alignItems: "center", padding: 0 },
            ]}
          >
            <AppIcon name="left" size={20} />
          </Pressable>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.cardTitle,
              { flex: 1, textAlign: "center", textTransform: "capitalize" },
            ]}
          >
            {mode === "day"
              ? dateLabel(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : mode === "week"
                ? `${dateLabel(days[0], { day: "numeric", month: "short" })} – ${dateLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}`
                : "Calendario del mes"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Período siguiente"
            disabled={!inBounds(next)}
            onPress={() => setDay(next)}
            style={[
              styles.chip,
              { width: 44, height: 44, alignItems: "center", padding: 0 },
            ]}
          >
            <AppIcon name="right" size={20} />
          </Pressable>
        </View>
        <View
          style={[
            styles.wrap,
            { alignItems: "center", justifyContent: "space-between" },
          ]}
        >
          {button("Hoy", () => setDay(localDay(new Date())), true)}
          <DateField label="Ir a fecha" value={day} onChange={setDay} compact />
        </View>
      </View>
      {!!message && (
        <Text accessibilityRole="alert" style={styles.body}>
          {message}
        </Text>
      )}
      {mode === "month" ? (
        <>
          <View style={[styles.card, { padding: 10, gap: 6 }]}>
            <View style={{ flexDirection: "row" }}>
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.muted,
                    {
                      width: "14.2857%",
                      textAlign: "center",
                      paddingVertical: 8,
                    },
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {monthDays(day).map((date) => {
                const daily = eventsOnDay(events, date),
                  selected = day === date;
                return (
                  <View
                    key={date}
                    style={{
                      width: "14.2857%",
                      minHeight: wide ? 132 : 100,
                      borderRightWidth: 1,
                      borderTopWidth: 1,
                      borderColor: styles.card.borderColor,
                      padding: 2,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver ${date}, ${daily.length} eventos`}
                      accessibilityState={{ selected }}
                      aria-selected={selected}
                      disabled={!inBounds(date)}
                      onPress={() => setDay(date)}
                      style={[
                        {
                          alignItems: "center",
                          minHeight: 44,
                          borderRadius: 16,
                          gap: 4,
                          justifyContent: "center",
                        },
                        selected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cardTitle,
                          {
                            color: selected
                              ? "#fff"
                              : date.slice(0, 7) === day.slice(0, 7)
                                ? styles.cardTitle.color
                                : styles.muted.color,
                          },
                          date === today && {
                            textDecorationLine: "underline",
                            fontWeight: "800",
                          },
                        ]}
                      >
                        {Number(date.slice(8))}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: selected ? "#fff" : styles.link.color,
                        }}
                      >
                        {daily.length
                          ? wide
                            ? `${daily.length} evento${daily.length === 1 ? "" : "s"}`
                            : `${daily.length} cita${daily.length === 1 ? "" : "s"}`
                          : " "}
                      </Text>
                    </Pressable>
                    {daily.slice(0, 2).map((event) => (
                      <Pressable
                        key={event.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir evento del calendario: ${event.title}`}
                        onPress={() => open(event)}
                        style={[
                          styles.secondary,
                          { borderRadius: 6, marginTop: 3, padding: 4 },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.muted,
                            { color: styles.cardTitle.color, fontSize: 11 },
                          ]}
                        >
                          {event.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.sectionHead}>
            <Text style={styles.cardTitle}>
              {dateLabel(day, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            <Text style={styles.muted}>
              {eventsOnDay(events, day).length} eventos
            </Text>
          </View>
          {eventsOnDay(events, day).map((event) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`Editar evento: ${event.title}`}
              onPress={() => open(event)}
              style={[
                styles.card,
                {
                  borderLeftWidth: 4,
                  borderLeftColor: styles.link.color,
                  gap: 8,
                },
              ]}
            >
              <Text style={styles.eyebrow}>{timeLabel(event)}</Text>
              <Text style={styles.cardTitle}>{event.title}</Text>
              {event.startsAt.slice(0, 10) !== event.endsAt.slice(0, 10) && (
                <Text style={styles.muted}>
                  {event.startsAt.slice(0, 10)} → {event.endsAt.slice(0, 10)}
                </Text>
              )}
              {!!event.location && (
                <Text style={styles.body}>⌖ {event.location}</Text>
              )}
              {!!event.description && (
                <Text numberOfLines={2} style={styles.muted}>
                  {event.description}
                </Text>
              )}
              <Text style={styles.link}>Ver y editar →</Text>
            </Pressable>
          ))}
          {!eventsOnDay(events, day).length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Un día con espacio</Text>
              <Text style={styles.body}>
                No hay eventos para esta fecha. Agrega uno con + Evento.
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.muted}>
            Desliza para recorrer las horas
            {mode === "week" ? " y los días" : ""}. Toca un evento para
            editarlo.
          </Text>
          <AgendaTimeline
            key={`${mode}:${day}`}
            days={days}
            selectedDay={day}
            onSelectDay={(date) => {
              setDay(date);
              setMode("day");
            }}
            events={events}
            now={now}
            onOpen={open}
          />
          {!days.some((d) => eventsOnDay(events, d).length) && (
            <Text style={styles.body}>No hay eventos en este período.</Text>
          )}
        </>
      )}
      <Text style={styles.muted}>
        Hora local del dispositivo ·{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone || "zona local"}
      </Text>
      <SheetModal
        visible={draft !== null || calendar.request !== null}
        onRequestClose={() => {
          if (calendar.request) calendar.close();
          else if (!busy) setDraft(null);
        }}
      >
        {calendar.request ? (
          <CalendarContent />
        ) : (
          draft && (
            <Sheet onClose={() => setDraft(null)} disabled={busy}>
              <Text style={styles.section}>
                {editing ? "Editar evento" : "Nuevo evento"}
              </Text>
              {field("Título del evento", "title", 120)}
              <DateField
                label="Fecha de inicio"
                value={draft.startsAt.slice(0, 10)}
                onChange={(date) =>
                  update("startsAt", `${date}T${draft.startsAt.slice(11)}`)
                }
              />
              <TimeField
                label="Hora de inicio"
                value={draft.startsAt.slice(11)}
                onChange={(time) =>
                  update("startsAt", `${draft.startsAt.slice(0, 10)}T${time}`)
                }
              />
              <DateField
                label="Fecha de fin"
                value={draft.endsAt.slice(0, 10)}
                onChange={(date) =>
                  update("endsAt", `${date}T${draft.endsAt.slice(11)}`)
                }
              />
              <TimeField
                label="Hora de fin"
                value={draft.endsAt.slice(11)}
                onChange={(time) =>
                  update("endsAt", `${draft.endsAt.slice(0, 10)}T${time}`)
                }
              />
              {field("Locación", "location", 200)}
              {field("Descripción", "description", 2000)}
              <View style={[styles.card, { padding: 16 }]}>
                <Text style={styles.cardTitle}>Recordatorios</Text>
                <Text style={styles.body}>
                  En Android, avisa a la hora del evento y el día anterior a esa
                  misma hora. Requiere permitir notificaciones.
                </Text>
                {(
                  [
                    ["remindDayBefore", "Un día antes"],
                    ["remindSameDay", "El mismo día"],
                  ] as const
                ).map(([key, label]) => (
                  <View
                    key={key}
                    style={[
                      styles.row,
                      { alignItems: "center", flexWrap: "wrap" },
                    ]}
                  >
                    <Text style={styles.body}>{label}</Text>
                    <Switch
                      accessibilityLabel={label}
                      value={draft[key]}
                      onValueChange={(value) => update(key, value)}
                      trackColor={{
                        false: styles.input.borderColor,
                        true: styles.button.backgroundColor,
                      }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </View>
              {!!error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              )}
              {confirmDelete ? (
                <View style={[styles.card, { padding: 16 }]}>
                  <Text style={styles.cardTitle}>¿Eliminar este evento?</Text>
                  <Text style={styles.body}>
                    {draft.title}. Esta acción no se puede deshacer.
                  </Text>
                  {button("Confirmar eliminación", () => {
                    void commit(true);
                  })}
                  {button(
                    "Conservar evento",
                    () => setConfirmDelete(false),
                    true,
                  )}
                </View>
              ) : (
                <>
                  {button(busy ? "Guardando…" : "Guardar evento", () => {
                    void commit();
                  })}
                  {editing &&
                    button(
                      "Eliminar evento",
                      () => setConfirmDelete(true),
                      true,
                    )}
                </>
              )}
              {button("Cancelar evento", () => setDraft(null), true)}
            </Sheet>
          )
        )}
        <FloatingFeedback
          modal
          active={draft !== null || calendar.request !== null}
        />
      </SheetModal>
    </View>
  );
}

function AgendaTimeline({
  days,
  selectedDay,
  onSelectDay,
  events,
  now,
  onOpen,
}: {
  days: string[];
  selectedDay: string;
  onSelectDay: (day: string) => void;
  events: AgendaEvent[];
  now: Date;
  onOpen: (event: AgendaEvent) => void;
}) {
  const { styles } = useTheme();
  const [width, setWidth] = useState(280);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const horizontal = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const header = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const positioned = useRef(false);
  const viewport = Math.max(180, width - 46);
  const column = Math.max(
    days.length === 1 ? 180 : 108,
    viewport / days.length,
  );
  const hourHeight = 56,
    scale = hourHeight / 60;
  const minuteLabel = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  useEffect(() => {
    const index = Math.max(0, days.indexOf(selectedDay));
    const x = Math.max(
      0,
      Math.min(
        index * column - (viewport - column) / 2,
        column * days.length - viewport,
      ),
    );
    horizontal.current?.scrollTo({ x, animated: false });
    header.current?.scrollTo({ x, animated: false });
  }, [selectedDay, column, viewport, days.length]);
  const earliest = Math.min(
    9 * 60,
    ...days.flatMap((d) => timelineEvents(events, d).map((item) => item.start)),
  );
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.card, { padding: 0, overflow: "hidden", gap: 0 }]}
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: styles.secondary.backgroundColor,
        }}
      >
        <View
          style={{ width: 46, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={[styles.muted, { fontSize: 10 }]}>Hora</Text>
        </View>
        <ScrollView
          ref={header}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ width: viewport }}
          contentContainerStyle={{ width: column * days.length }}
        >
          {days.map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={`Ver día ${d}`}
              onPress={() => onSelectDay(d)}
              style={{
                width: column,
                padding: 10,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={styles.muted}>
                {dateLabel(d, { weekday: "short" })}
              </Text>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    minWidth: 30,
                    textAlign: "center",
                    padding: 4,
                    borderRadius: 12,
                  },
                  d === selectedDay && {
                    backgroundColor: styles.button.backgroundColor,
                    color: "#fff",
                  },
                  d === localDay(now) && {
                    color: d === selectedDay ? "#fff" : styles.link.color,
                    textDecorationLine: "underline",
                  },
                ]}
              >
                {Number(d.slice(8))}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView
        ref={scroll}
        nestedScrollEnabled
        style={{ height: 480 }}
        onContentSizeChange={() => {
          if (!positioned.current) {
            scroll.current?.scrollTo({
              y: Math.max(0, (earliest - 60) * scale),
              animated: false,
            });
            positioned.current = true;
          }
        }}
      >
        <View style={{ flexDirection: "row", height: 24 * hourHeight }}>
          <View style={{ width: 46 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <Text
                key={h}
                style={[
                  styles.muted,
                  {
                    height: hourHeight,
                    fontSize: 11,
                    paddingTop: 4,
                    textAlign: "center",
                  },
                ]}
              >
                {String(h).padStart(2, "0")}:00
              </Text>
            ))}
          </View>
          <ScrollView
            ref={horizontal}
            horizontal
            nestedScrollEnabled
            style={{ width: viewport }}
            contentContainerStyle={{
              width: column * days.length,
              height: 24 * hourHeight,
            }}
            scrollEventThrottle={16}
            onScroll={(e) =>
              header.current?.scrollTo({
                x: e.nativeEvent.contentOffset.x,
                animated: false,
              })
            }
          >
            {days.map((d) => (
              <View
                key={d}
                style={{
                  width: column,
                  height: 24 * hourHeight,
                  borderLeftWidth: 1,
                  borderColor: styles.card.borderColor,
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <View
                    key={h}
                    style={{
                      position: "absolute",
                      top: h * hourHeight,
                      width: "100%",
                      borderTopWidth: 1,
                      borderColor: styles.card.borderColor,
                    }}
                  />
                ))}
                {timelineEvents(events, d).map(
                  ({ event, start, end, visualEnd, lane, lanes }) => (
                    <Pressable
                      key={event.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar evento: ${event.title}`}
                      onPress={() => onOpen(event)}
                      style={[
                        styles.chipSelected,
                        {
                          position: "absolute",
                          top: start * scale,
                          left: `${(lane / lanes) * 100}%`,
                          width: `${100 / lanes}%`,
                          height: (visualEnd - start) * scale,
                          padding: 5,
                          borderRadius: 8,
                          borderWidth: 1,
                          overflow: "hidden",
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.buttonText, { fontSize: 12 }]}
                      >
                        {event.title}
                      </Text>
                      {(visualEnd - start) * scale > 44 && (
                        <Text style={{ color: "#fff", fontSize: 11 }}>
                          {minuteLabel(start)} – {minuteLabel(end)}
                        </Text>
                      )}
                    </Pressable>
                  ),
                )}
                {d === localDay(now) && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: (now.getHours() * 60 + now.getMinutes()) * scale,
                      width: "100%",
                      height: 2,
                      backgroundColor: styles.error.color,
                    }}
                  />
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}
