import type { AgendaEvent } from "./agenda";
export function agendaReminders(
  events: AgendaEvent[],
  owner: string,
  now = Date.now(),
) {
  return events.flatMap((event) => {
    const start = new Date(event.startsAt),
      before = new Date(start);
    before.setDate(before.getDate() - 1);
    return (
      [
        ["day-before", event.remindDayBefore, before],
        ["same-day", event.remindSameDay, start],
      ] as const
    )
      .filter(
        ([, enabled, date]) =>
          enabled && Number.isFinite(date.valueOf()) && date.valueOf() > now,
      )
      .map(([kind, , date]) => ({
        id: `agendapp:${owner}:${event.id}:${kind}`,
        date,
        title: event.title,
        body:
          kind === "day-before"
            ? `Mañana a las ${event.startsAt.slice(11)}${event.location ? " · " + event.location : ""}`
            : `Tu evento empieza ahora${event.location ? " · " + event.location : ""}`,
        owner,
        eventId: event.id,
      }));
  });
}
export type Reminder = ReturnType<typeof agendaReminders>[number];
export const reminderFingerprint = (r: Reminder) =>
  JSON.stringify([r.date.valueOf(), r.title, r.body]);
export function reminderPlan(
  wanted: Reminder[],
  scheduled: {
    identifier: string;
    content: { data?: Record<string, unknown> };
  }[],
) {
  const desired = new Map(wanted.map((r) => [r.id, r]));
  const kept = new Set<string>(),
    cancel: string[] = [];
  for (const old of scheduled) {
    if (old.content.data?.source !== "agendapp-agenda") continue;
    const next = desired.get(old.identifier);
    if (!next || old.content.data.fingerprint !== reminderFingerprint(next))
      cancel.push(old.identifier);
    else kept.add(old.identifier);
  }
  return { cancel, schedule: wanted.filter((r) => !kept.has(r.id)) };
}
