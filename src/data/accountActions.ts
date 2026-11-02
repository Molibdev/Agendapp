import { z } from "zod";
export const RECOVERY_MARKER = "agendapp:password-recovery";
const emailSchema = z.string().trim().email().max(254);
export function accountEmail(value: string) {
  const parsed = emailSchema.safeParse(value);
  if (!parsed.success)
    throw new Error("Introduce un correo electrónico válido.");
  return parsed.data;
}
export function accountPassword(password: string, confirmation: string) {
  if (password.length < 8 || new TextEncoder().encode(password).length > 72)
    throw new Error(
      "La contraseña debe tener al menos 8 caracteres y un máximo de 72 bytes.",
    );
  if (password !== confirmation)
    throw new Error("Las contraseñas no coinciden.");
  return password;
}
type Result = {
  error: { message: string; status?: number; code?: string } | null;
};
export type AccountAuth = {
  resetPasswordForEmail: (
    email: string,
    options: { redirectTo: string },
  ) => Promise<Result>;
  resend: (options: {
    type: "signup";
    email: string;
    options: { emailRedirectTo: string };
  }) => Promise<Result>;
  updateUser: (options: { password: string }) => Promise<Result>;
};
export async function requestAccountEmail(
  auth: AccountAuth,
  kind: "recovery" | "confirmation",
  email: string,
  redirectTo: string,
) {
  const address = accountEmail(email);
  const { error } =
    kind === "recovery"
      ? await auth.resetPasswordForEmail(address, { redirectTo })
      : await auth.resend({
          type: "signup",
          email: address,
          options: { emailRedirectTo: redirectTo },
        });
  if (error)
    throw new Error(
      error.status === 429 || error.code === "over_email_send_rate_limit"
        ? "Ya se solicitó un correo recientemente. Espera unos minutos antes de intentarlo otra vez."
        : "No pudimos enviar el correo. Inténtalo más tarde o contacta con soporte.",
    );
  return "Si el correo corresponde a una cuenta que lo necesita, recibirás un mensaje. Revisa también la carpeta de spam y abre el enlace en el mismo dispositivo y navegador donde lo solicitaste.";
}
export async function updateRecoveredPassword(
  auth: AccountAuth,
  password: string,
  confirmation: string,
) {
  const value = accountPassword(password, confirmation);
  const { error } = await auth.updateUser({ password: value });
  if (error)
    throw new Error(
      error.code === "same_password"
        ? "Elige una contraseña diferente de la anterior."
        : "No se pudo cambiar la contraseña. Solicita un nuevo enlace de recuperación e inténtalo otra vez.",
    );
}
export function validRecoveryMarker(
  raw: string | null,
  userId: string,
  now = Date.now(),
) {
  try {
    const value = JSON.parse(raw ?? "null");
    return (
      value?.userId === userId &&
      Number.isFinite(value.expiresAt) &&
      value.expiresAt > now
    );
  } catch {
    return false;
  }
}
// Only app-owned callback URLs may exchange an auth code. Never log the code.
export function nativeAuthCode(url: string) {
  const parsed = new URL(url);
  if (
    !["agendapp:", "qgasto:"].includes(parsed.protocol) ||
    parsed.hostname ||
    !["", "/"].includes(parsed.pathname)
  )
    return null;
  if (parsed.searchParams.has("error"))
    throw new Error(
      "El enlace de acceso venció o fue rechazado. Solicita otro correo e inténtalo de nuevo.",
    );
  const code = parsed.searchParams.get("code");
  return code
    ? { code, flowId: parsed.searchParams.get("sb_flow_id") ?? undefined }
    : null;
}
export async function logoutProfile(options: {
  forget: boolean;
  flush: () => Promise<unknown>;
  read: () => Promise<string | null>;
  remove: () => Promise<unknown>;
  restore: (raw: string) => Promise<unknown>;
  signOut: () => Promise<unknown>;
}) {
  let original: string | null = null;
  if (options.forget) {
    await options.flush();
    original = await options.read();
    await options.remove();
  }
  try {
    await options.signOut();
  } catch (error) {
    if (options.forget && original !== null) await options.restore(original);
    throw error;
  }
}
