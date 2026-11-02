import { Platform } from "react-native";
import type { AgendaEvent } from "../domain/agenda";
import {
  agendaReminders,
  reminderPlan,
  reminderFingerprint,
} from "../domain/reminders";
let initialized = false,
  version = 0,
  queue = Promise.resolve();
async function api() {
  const n = await import("expo-notifications");
  if (!initialized) {
    n.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await n.setNotificationChannelAsync("agenda", {
      name: "Recordatorios de Agenda",
      importance: n.AndroidImportance.HIGH,
    });
    initialized = true;
  }
  return n;
}
export async function requestAgendaPermission() {
  if (Platform.OS !== "android") return false;
  const n = await api();
  const current = await n.getPermissionsAsync();
  return current.granted || (await n.requestPermissionsAsync()).granted;
}
export function reconcileAgendaNotifications(
  events: AgendaEvent[],
  owner: string,
) {
  if (Platform.OS !== "android") return Promise.resolve();
  const current = ++version;
  const work = queue
    .catch(() => {})
    .then(async () => {
      if (current !== version) return;
      const n = await api();
      const permission = await n.getPermissionsAsync();
      const wanted = permission.granted ? agendaReminders(events, owner) : [];
      const plan = reminderPlan(
        wanted,
        await n.getAllScheduledNotificationsAsync(),
      );
      for (const id of plan.cancel) {
        if (current !== version) return;
        await n.cancelScheduledNotificationAsync(id);
      }
      for (const r of plan.schedule) {
        if (current !== version) return;
        await n.scheduleNotificationAsync({
          identifier: r.id,
          content: {
            title: r.title,
            body: r.body,
            sound: "default",
            data: {
              source: "agendapp-agenda",
              owner,
              fingerprint: reminderFingerprint(r),
            },
          },
          trigger: {
            type: n.SchedulableTriggerInputTypes.DATE,
            date: r.date,
            channelId: "agenda",
          },
        });
      }
      for (const shown of await n.getPresentedNotificationsAsync()) {
        if (
          shown.request.content.data?.source === "agendapp-agenda" &&
          shown.request.content.data?.owner !== owner
        )
          await n.dismissNotificationAsync(shown.request.identifier);
      }
    });
  queue = work;
  return work;
}
