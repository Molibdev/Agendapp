// Local-only audit. Never print the key, decoded payload, tokens or passwords.
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const project = "https://argaugyjsccoznvdvtvw.supabase.co";
let configured;
try {
  configured = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "");
} catch {
  console.error("FAIL: falta una URL base válida de Supabase.");
  process.exit(1);
}
if (configured.origin !== project || !["", "/"].includes(configured.pathname)) {
  console.error(
    "FAIL: la URL no es la base del proyecto Agendapp esperado. No se realizó ninguna petición.",
  );
  process.exit(1);
}
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
let publicKey =
  key.startsWith("sb_publishable_") && key.length > "sb_publishable_".length;
if (!publicKey && key.split(".").length === 3) {
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
    );
    publicKey = payload.role === "anon";
  } catch {
    /* A malformed token is not a confirmed public client key. */
  }
}
if (!publicKey) {
  console.error(
    "FAIL: no se pudo confirmar una clave pública publishable/anon. No uses secret, service_role, un access token de usuario ni un token personal. No compartas el valor.",
  );
  process.exit(1);
}
console.log("PASS: URL base del proyecto esperado.");
console.log(
  "PASS: formato de clave pública publishable/anon. No se mostró ni se envió su valor.",
);
console.log(
  "PENDIENTE: este control local no verifica la firma, vigencia ni las políticas RLS del servidor.",
);
