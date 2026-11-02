import { useEffect } from "react";
import { AppState } from "react-native";
import type { AgendaEvent } from "../domain/agenda";
import { reconcileAgendaNotifications } from "../data/agendaNotifications";
import { notify } from "../data/feedback";
export function AgendaNotifications({
  events,
  owner,
}: {
  events: AgendaEvent[];
  owner: string;
}) {
  useEffect(() => {
    const sync = () => {
      void reconcileAgendaNotifications(events, owner).catch(() =>
        notify(
          "No se pudieron actualizar los recordatorios de Agenda. Revisa los permisos de notificaciones.",
          "error",
          "agenda-permission",
        ),
      );
    };
    sync();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => listener.remove();
  }, [events, owner]);
  return null;
}
