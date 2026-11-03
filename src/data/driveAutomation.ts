import type { Session } from "@supabase/supabase-js";
export const driveAutomationEnabled =
  process.env.EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED === "true";
const statusListeners = new Set<() => void>();
export function subscribeDriveStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}
export async function driveService(
  session: Session | null,
  action: string,
  extra: Record<string, unknown> = {},
) {
  if (!driveAutomationEnabled)
    throw new Error(
      "Los servicios automáticos aún no están activos en esta instalación.",
    );
  if (!session) throw new Error("Inicia sesión para conectar Drive.");
  const response = await fetch(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") +
      "/functions/v1/drive-service",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
        Authorization: "Bearer " + session.access_token,
      },
      body: JSON.stringify({ ...extra, action }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error === "GOOGLE_RECONNECT"
        ? "Vuelve a conectar Google para renovar el permiso de Drive."
        : "No se pudo conectar el servicio de Drive. Revisa la conexión y vuelve a intentarlo.",
    );
  if (["connect", "preferences", "disconnect"].includes(action))
    statusListeners.forEach((listener) => listener());
  return data;
}
export async function resolveDriveToken(
  session: Session | null,
): Promise<string> {
  if (driveAutomationEnabled)
    return (await driveService(session, "token")).access_token;
  if (!session?.provider_token)
    throw new Error("Conecta Google desde Perfil para autorizar Drive.");
  return session.provider_token;
}
