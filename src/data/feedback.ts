export type Feedback = {
  message: string;
  kind: "success" | "error" | "info";
  durationMs?: number;
};
export const feedbackText = (event: Feedback) =>
  `${event.message} ${event.kind === "success" ? "✓" : event.kind === "error" ? "×" : "i"}`;
const listeners = new Set<(event: Feedback) => void>();
const recent = new Map<string, number>();
const hosts = new Map<string, { priority: number; order: number }>();
let hostOrder = 0;
let snapshot: { messages: Feedback[]; host: string | null } = {
  messages: [],
  host: null,
};
const views = new Set<() => void>();
const publish = () => views.forEach((view) => view());
export const feedbackSnapshot = () => snapshot;
export function subscribeFeedbackView(view: () => void) {
  views.add(view);
  return () => {
    views.delete(view);
  };
}
export function registerFeedbackHost(id: string, priority: number) {
  hosts.set(id, { priority, order: ++hostOrder });
  const selectHost = () => {
    const ranked = [...hosts].sort(
      (a, b) => b[1].priority - a[1].priority || b[1].order - a[1].order,
    );
    snapshot = { ...snapshot, host: ranked[0]?.[0] ?? null };
    publish();
  };
  selectHost();
  return () => {
    hosts.delete(id);
    selectHost();
  };
}
export function dismissFeedback() {
  snapshot = { ...snapshot, messages: snapshot.messages.slice(1) };
  publish();
}
export function notify(
  message: string,
  kind: Feedback["kind"] = "success",
  key?: string,
  durationMs?: number,
) {
  if (!message) return;
  if (key) {
    const now = Date.now();
    if (now - (recent.get(key) ?? 0) < 15000) return;
    recent.set(key, now);
    if (recent.size > 100) recent.delete(recent.keys().next().value!);
  }
  const event: Feedback = {
    message,
    kind,
    ...(durationMs === undefined ? {} : { durationMs }),
  };
  // Keep the visible message stable during bursts; retain the latest waiting actions.
  const messages =
    snapshot.messages.length >= 4
      ? [snapshot.messages[0], ...snapshot.messages.slice(-2), event]
      : [...snapshot.messages, event];
  snapshot = { ...snapshot, messages };
  publish();
  listeners.forEach((listener) => listener(event));
}
export function subscribeFeedback(listener: (event: Feedback) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
