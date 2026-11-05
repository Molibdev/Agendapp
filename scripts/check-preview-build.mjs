// Runs on EAS after dependencies are installed, with the selected EAS environment.
// Never print configuration values or include administrative credentials in the APK.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.EAS_BUILD_PROFILE !== "preview") {
  console.log("Configuración preview: no aplica a este perfil.");
  process.exit(0);
}
const check = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("./check-public-client-key.mjs", import.meta.url))],
  { stdio: "inherit" },
);
if (check.error || check.status !== 0) {
  console.error(
    "APK detenida: configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en el entorno preview de EAS. Revisa docs/android-preview.md.",
  );
  process.exit(1);
}
if (process.env.EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED !== "true") {
  console.error(
    "APK detenida: configura EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED=true en el entorno preview de EAS para conservar el servicio de Drive ya habilitado.",
  );
  process.exit(1);
}
console.log(
  "PASS: configuración pública de Supabase y Drive para APK preview.",
);
