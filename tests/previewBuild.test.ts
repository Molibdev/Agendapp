import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const check = fileURLToPath(
  new URL("../scripts/check-preview-build.mjs", import.meta.url),
);
const valid = {
  EAS_BUILD_PROFILE: "preview",
  EXPO_PUBLIC_SUPABASE_URL: "https://argaugyjsccoznvdvtvw.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fixture_only",
  EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED: "true",
};
function run(overrides: Record<string, string>) {
  // Isolate from any developer .env.local and inherited public configuration.
  const cwd = mkdtempSync(join(tmpdir(), "agendapp-preview-check-"));
  try {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    for (const key of Object.keys(env))
      if (key.startsWith("EXPO_PUBLIC_") || key === "EAS_BUILD_PROFILE")
        delete env[key];
    const result = spawnSync(process.execPath, [check], {
      cwd,
      env: { ...env, ...overrides },
      encoding: "utf8",
    });
    assert.ifError(result.error);
    return result;
  } finally {
    rmdirSync(cwd);
  }
}

test("preview genera APK release interna, con entorno propio y firma existente", () => {
  const config = JSON.parse(
    readFileSync(new URL("../eas.json", import.meta.url), "utf8"),
  );
  assert.equal(config.build.preview.developmentClient, false);
  assert.equal(config.build.preview.distribution, "internal");
  assert.equal(config.build.preview.environment, "preview");
  assert.equal(config.build.preview.android.buildType, "apk");
  assert.equal(config.build.preview.credentialsSource, "remote");
  assert.equal(config.build.preview.android.gradleCommand, undefined);
  assert.equal(config.build.development.developmentClient, true);
});

test("el control no interfiere con el perfil development", () => {
  assert.equal(run({ EAS_BUILD_PROFILE: "development" }).status, 0);
});

test("preview se detiene si falta la configuración pública", () => {
  const result = run({ EAS_BUILD_PROFILE: "preview" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /APK detenida/);
});

test("preview rechaza claves administrativas y URL de API en lugar de URL base", () => {
  const secret = "sb_secret_fixture_only";
  const result = run({ ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: secret });
  assert.equal(result.status, 1);
  assert.equal((result.stdout + result.stderr).includes(secret), false);
  assert.equal(
    run({
      ...valid,
      EXPO_PUBLIC_SUPABASE_URL: valid.EXPO_PUBLIC_SUPABASE_URL + "/rest/v1/",
    }).status,
    1,
  );
});

test("preview exige el servicio Drive habilitado y acepta configuración pública completa", () => {
  assert.equal(
    run({ ...valid, EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED: "false" }).status,
    1,
  );
  const result = run(valid);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout.includes(valid.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    false,
  );
});
