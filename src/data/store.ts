import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  apply,
  Command,
  initialState,
  State,
  processRecurring,
  today,
} from "../domain/finance";
import { reconcile } from "../domain/sync";
import { AppState } from "react-native";
import { validateState } from "../domain/backup";
import { useAuth } from "./auth";
import { pullCloud, pushCloud } from "./cloud";
import { notify } from "./feedback";
import { logoutProfile } from "./accountActions";
import { supabase } from "./auth";
import { useEffect, useState, useMemo } from "react";
export const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
type Local = { state: State; revision: number; dirty: boolean };
export function useFinance() {
  const { session, loading, setAccountNotice } = useAuth(),
    owner = session?.user.id ?? "guest",
    cache = useQueryClient();
  const queryKey = ["finance", owner],
    key = owner === "guest" ? "qgasto:data:v1" : `qgasto:data:${owner}`;
  const [syncMessage, setSyncMessage] = useState("");
  const lifecycle = useMemo(() => ({ closing: false }), [owner]);
  const query = useQuery({
    queryKey,
    enabled: !loading,
    queryFn: async (): Promise<Local> => {
      const raw = await AsyncStorage.getItem(key);
      let local: Local;
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        local = parsed?.state
          ? {
              state: validateState(parsed.state),
              revision: parsed.revision ?? 0,
              dirty: !!parsed.dirty,
            }
          : {
              state: parsed ? validateState(parsed) : initialState,
              revision: 0,
              dirty: !!parsed,
            };
      } catch {
        throw new Error(
          "No se pueden leer los datos locales. No se han sobrescrito.",
        );
      }
      const state = processRecurring(local.state, today());
      if (JSON.stringify(state) !== JSON.stringify(local.state)) {
        local = { ...local, state, dirty: true };
        await AsyncStorage.setItem(key, JSON.stringify(local));
      }
      return local;
    },
  });
  const mutation = useMutation({
    scope: { id: `finance:${owner}` },
    mutationFn: async (
      action:
        | { command: Command }
        | { restore: State }
        | { sync: true }
        | { pull: true }
        | { logout: true; forget: boolean },
    ) => {
      if (lifecycle.closing && !("logout" in action))
        throw new Error("La sesión se está cerrando.");
      const local = cache.getQueryData<Local>(queryKey);
      if (!local) throw new Error("Espera a que se carguen los datos");
      if ("logout" in action) {
        if (!session || !supabase) throw new Error("No hay sesión activa.");
        await logoutProfile({
          forget: action.forget,
          flush: async () => {
            try {
              const next = await reconcile(
                local,
                await pullCloud(owner),
                (state, revision) => pushCloud(owner, state, revision),
              );
              await AsyncStorage.setItem(key, JSON.stringify(next));
              cache.setQueryData(queryKey, next);
            } catch (error) {
              if (error instanceof Error && error.message.includes("Conflicto"))
                throw error;
              throw new Error(
                "No se pudo sincronizar. La copia local y la sesión se conservan. Revisa la conexión o los permisos antes de volver a intentarlo.",
              );
            }
          },
          read: () => AsyncStorage.getItem(key),
          remove: () => AsyncStorage.removeItem(key),
          restore: (raw) => AsyncStorage.setItem(key, raw),
          signOut: async () => {
            const { error } = await supabase!.auth.signOut({ scope: "local" });
            if (error) throw error;
          },
        });
        if (action.forget) cache.removeQueries({ queryKey, exact: true });
        setAccountNotice(
          action.forget
            ? "Sesión cerrada. La copia de este perfil se eliminó de este dispositivo. Los datos de la nube y el perfil invitado se conservan."
            : "Sesión cerrada. La copia local de este perfil se conserva en el dispositivo.",
        );
        return;
      }
      let next = local;
      if ("command" in action) {
        const state = apply(local.state, action.command);
        if (JSON.stringify(state) === JSON.stringify(local.state)) return;
        next = { ...local, state, dirty: true };
      }
      if ("restore" in action)
        next = { ...local, state: validateState(action.restore), dirty: true };
      if ("pull" in action) {
        const remote = await pullCloud(owner);
        if (!remote) throw new Error("No hay datos en la nube");
        next = { ...remote, dirty: false };
      }
      if ("sync" in action) {
        if (!session) throw new Error("Inicia sesión para sincronizar");
        const remote = await pullCloud(owner);
        next = await reconcile(local, remote, (state, revision) =>
          pushCloud(owner, state, revision),
        );
      }
      if (JSON.stringify(next) === JSON.stringify(local)) return;
      await AsyncStorage.setItem(key, JSON.stringify(next));
      cache.setQueryData(queryKey, next);
      if ("command" in action) {
        const labels: Record<string, string> = {
          transaction:
            action.command.kind === "transaction" &&
            action.command.value.type === "income"
              ? "Ingreso registrado"
              : "Gasto registrado",
          "update-transaction": "Movimiento actualizado",
          event: "Evento creado",
          "update-event": "Evento actualizado",
          "delete-event": "Evento eliminado",
          account: "Cuenta creada",
          "update-account": "Cuenta actualizada",
          category: "Categoría guardada",
          budget: "Presupuesto guardado",
          goal: "Meta creada",
          contribution: "Aporte guardado",
          recurring: "Pago mensual guardado",
          "resize-installments": "Cuotas actualizadas",
          "settle-installments": "Pago anticipado registrado",
          "toggle-recurring": "Recurrente actualizado",
          "process-recurring": "Movimientos recurrentes registrados",
        };
        if (labels[action.command.kind]) notify(labels[action.command.kind]);
      }
      if ("restore" in action) notify("Copia restaurada");
      if ("sync" in action)
        notify(
          "Cuenta sincronizada",
          "success",
          `sync:${owner}:${next.revision}`,
        );
      if ("pull" in action) notify("Datos de la nube cargados");
    },
  });
  const revision = query.data?.revision,
    dirty = query.data?.dirty;
  useEffect(() => {
    if (!session || !query.data) return;
    const timer = setTimeout(() => {
      void mutation
        .mutateAsync({ sync: true })
        .then(() => setSyncMessage("Sincronizado"))
        .catch((e) => {
          setSyncMessage(e.message);
          if (!lifecycle.closing)
            notify(
              "No se pudo sincronizar. Tus cambios se conservan en este dispositivo.",
              "error",
              `sync-error:${owner}`,
            );
        });
    }, 2000);
    return () => clearTimeout(timer);
  }, [owner, revision, dirty, query.dataUpdatedAt]);
  // Recalcular al volver al primer plano y periódicamente con la app abierta.
  useEffect(() => {
    const process = () => {
      if (cache.getQueryData(queryKey))
        void mutation
          .mutateAsync({
            command: { kind: "process-recurring", date: today() },
          })
          .catch(() => {});
    };
    const timer = setInterval(process, 60000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        process();
        if (session)
          void mutation.mutateAsync({ sync: true }).catch((e) => {
            setSyncMessage(e.message);
            if (!lifecycle.closing)
              notify(
                "No se pudo sincronizar. Tus cambios se conservan en este dispositivo.",
                "error",
                `sync-error:${owner}`,
              );
          });
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [owner]);
  return {
    ...query,
    data: query.data?.state,
    logout: async (forget = false) => {
      if (lifecycle.closing) throw new Error("La sesión se está cerrando.");
      lifecycle.closing = true;
      try {
        await mutation.mutateAsync({ logout: true, forget });
      } catch (error) {
        lifecycle.closing = false;
        throw error;
      }
    },
    save: (command: Command) => mutation.mutateAsync({ command }),
    restore: (state: State) => mutation.mutateAsync({ restore: state }),
    sync: () => mutation.mutateAsync({ sync: true }),
    pull: () => mutation.mutateAsync({ pull: true }),
    saving: mutation.isPending,
    syncMessage,
  };
}
