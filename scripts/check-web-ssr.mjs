// Regression: web rendering used to crash in AsyncStorage when Supabase was set.
// These deliberately nonfunctional public settings must never contact a server.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const output = mkdtempSync(join(tmpdir(), "agendapp-ssr-"));
try {
  execFileSync(
    process.execPath,
    [
      resolve("node_modules/expo/bin/cli"),
      "export",
      "--platform",
      "web",
      "--output-dir",
      output,
      "--max-workers",
      "2",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CI: "1",
        EXPO_OFFLINE: "1",
        EXPO_NO_DOTENV: "1",
        EXPO_NO_CLIENT_ENV_VARS: "0",
        EXPO_PUBLIC_SUPABASE_URL: "https://auth-ssr.invalid",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-ssr-fixture",
      },
    },
  );
  assert.match(readFileSync(join(output, "index.html"), "utf8"), /<html/);
  console.log(
    "PASS: web SSR with Supabase configured completes without browser storage access.",
  );
} finally {
  rmSync(output, { recursive: true, force: true });
}
