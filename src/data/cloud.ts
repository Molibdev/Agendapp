import { supabase } from "./auth";
import { validateState } from "../domain/backup";
import { State } from "../domain/finance";
export async function pullCloud(userId: string) {
  if (!supabase) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase
    .from("finance_snapshots")
    .select("data,revision")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { state: validateState(data.data), revision: Number(data.revision) }
    : null;
}
export async function pushCloud(
  userId: string,
  state: State,
  revision: number,
) {
  if (!supabase) throw new Error("Supabase no está configurado");
  const payload = {
    data: validateState(state),
    revision: revision + 1,
    updated_at: new Date().toISOString(),
  };
  const result =
    revision === 0
      ? await supabase
          .from("finance_snapshots")
          .insert({ ...payload, user_id: userId })
          .select("revision")
          .single()
      : await supabase
          .from("finance_snapshots")
          .update(payload)
          .eq("user_id", userId)
          .eq("revision", revision)
          .select("revision")
          .maybeSingle();
  if (result.error || !result.data)
    throw new Error(
      "No se pudo sincronizar: puede haber cambios en otro dispositivo. Descarga una copia local antes de cargar la nube. " +
        (result.error?.message ?? ""),
    );
  return Number(result.data.revision);
}
export {
  uploadDrive,
  listDrive,
  restoreDrive,
  uploadExcelDrive,
} from "./drive";
