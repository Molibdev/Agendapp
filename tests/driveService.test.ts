import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/domain/finance";
import { readBackup } from "../src/domain/backup";
import { unseal } from "../supabase/functions/drive-service/core";

test("servicio Drive: autenticación, aislamiento, renovación y respaldos idempotentes", async (t) => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const uid = "00000000-0000-4000-8000-000000000001";
  const other = "00000000-0000-4000-8000-000000000002";
  const vars: Record<string, string> = {
    SUPABASE_URL: "https://fixture.invalid",
    SUPABASE_ANON_KEY: "public",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
    DRIVE_ENCRYPTION_KEY: key,
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
    BACKUP_CRON_SECRET: "cron-only",
  };
  let handler!: (req: Request) => Promise<Response>;
  const globals = globalThis as typeof globalThis & { Deno?: unknown };
  const oldDeno = globals.Deno,
    oldFetch = globalThis.fetch;
  globals.Deno = {
    env: { get: (name: string) => vars[name] },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  };
  let row: any = null,
    run: any = null,
    file = false,
    uploads = 0,
    loseResponse = false,
    revoked = false,
    disableBeforeUpload = false;
  let lastUpload = "",
    calls: string[] = [];
  const json = (v: unknown, status = 200) =>
    new Response(JSON.stringify(v), { status });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)),
      method = init.method ?? "GET";
    calls.push(method + " " + url.pathname + url.search);
    const headers = new Headers(init.headers);
    if (url.pathname === "/auth/v1/user")
      return headers.get("Authorization") === "Bearer user-a"
        ? json({ id: uid })
        : json({}, 401);
    if (url.hostname === "oauth2.googleapis.com") {
      assert.equal(
        new URLSearchParams(init.body as URLSearchParams).get("refresh_token"),
        "google-refresh",
      );
      return revoked
        ? json({ error: "invalid_grant" }, 400)
        : json({ access_token: "fresh-google-token" });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      assert.equal(headers.get("Authorization"), "Bearer server-only");
      const body = init.body ? JSON.parse(String(init.body)) : null;
      if (url.pathname.endsWith("drive_connections")) {
        const filter = url.searchParams.get("user_id");
        if (filter)
          assert.equal(filter, "eq." + uid, "never trusts input.user_id");
        if (method === "POST") {
          row = { automatic_enabled: false, ...body };
          return json([row]);
        }
        if (method === "DELETE") {
          row = null;
          return new Response(null, { status: 204 });
        }
        if (method === "PATCH") {
          if (row) Object.assign(row, body);
          return json(row ? [row] : []);
        }
        if (url.searchParams.has("automatic_enabled"))
          return json(row?.automatic_enabled ? [row] : []);
        if (
          disableBeforeUpload &&
          calls.some((c) => c.includes("/files/reserved?"))
        )
          row.automatic_enabled = false;
        return json(row ? [row] : []);
      }
      if (url.pathname.endsWith("finance_snapshots"))
        return json([{ data: initialState, revision: 3 }]);
      if (url.pathname.endsWith("drive_backup_runs")) {
        if (method === "POST") {
          run ??= body;
          return json([run]);
        }
        if (method === "PATCH") {
          Object.assign(run, body);
          return json([run]);
        }
        return json(run ? [run] : []);
      }
    }
    if (url.pathname === "/drive/v3/about")
      return json({ user: { displayName: "Fixture" } });
    if (url.pathname === "/drive/v3/files/generateIds")
      return json({ ids: ["reserved"] });
    if (url.pathname === "/drive/v3/files/reserved")
      return file ? json({ id: "reserved" }) : json({}, 404);
    if (url.pathname === "/upload/drive/v3/files") {
      uploads++;
      file = true;
      lastUpload = String(init.body);
      if (loseResponse) {
        loseResponse = false;
        throw new Error("response lost after Google saved file");
      }
      return json({ id: "reserved" });
    }
    throw new Error("Unexpected fixture request: " + url);
  };
  const request = (body: unknown, auth = "user-a", cron = "") =>
    handler(
      new Request("https://fixture.invalid/functions/v1/drive-service", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: "Bearer " + auth } : {}),
          ...(cron ? { "x-agendapp-cron-secret": cron } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  try {
    await import("../supabase/functions/drive-service/index.ts");
    await t.test(
      "rechaza JWT ausente/inválido y cron sin secreto antes de consultar datos",
      async () => {
        calls = [];
        assert.equal((await request({ action: "status" }, "")).status, 401);
        assert.equal(
          (await request({ action: "status" }, "invalid")).status,
          401,
        );
        assert.equal((await request({ action: "cron" })).status, 401);
        assert.equal(
          calls.some((c) => c.includes("/rest/v1/")),
          false,
        );
      },
    );
    await t.test(
      "cifra el permiso para el UID autenticado e ignora el UID enviado por el cliente",
      async () => {
        const response = await request({
          action: "connect",
          user_id: other,
          refresh_token: "google-refresh",
        });
        assert.equal(response.status, 200);
        assert.equal(row.user_id, uid);
        assert.equal(row.automatic_enabled, false);
        assert.equal(
          await unseal(row.encrypted_refresh, uid, key),
          "google-refresh",
        );
        await assert.rejects(unseal(row.encrypted_refresh, other, key));
        assert.equal(
          JSON.stringify(await response.json()).includes("refresh"),
          false,
        );
        const status = await (
          await request({ action: "status", user_id: other })
        ).json();
        assert.equal(status.encrypted_refresh, undefined);
      },
    );
    await t.test(
      "renueva access tokens sin devolver el refresh y permite optar por respaldos",
      async () => {
        const result = await (await request({ action: "token" })).json();
        assert.deepEqual(result, { access_token: "fresh-google-token" });
        assert.equal(
          (await request({ action: "preferences", enabled: "yes" })).status,
          400,
        );
        assert.equal(
          (await request({ action: "preferences", enabled: true })).status,
          200,
        );
        assert.equal(row.automatic_enabled, true);
      },
    );
    await t.test(
      "respuesta perdida: el siguiente cron confirma el mismo archivo sin duplicarlo",
      async () => {
        loseResponse = true;
        let result = await (
          await request({ action: "cron" }, "", "cron-only")
        ).json();
        assert.equal(result.failed, 1);
        assert.equal(uploads, 1);
        assert.equal(run.file_id, "reserved");
        result = await (
          await request({ action: "cron" }, "", "cron-only")
        ).json();
        assert.equal(result.failed, 0);
        assert.equal(run.completed, true);
        assert.equal(uploads, 1);
        const content = lastUpload
          .split("Content-Type: application/json\r\n\r\n")[2]
          .split("\r\n--")[0];
        assert.deepEqual(
          readBackup(content),
          initialState,
          "automatic backup is restorable by the app",
        );
      },
    );
    await t.test(
      "desactivar antes de subir impide crear el archivo pendiente",
      async () => {
        run = null;
        file = false;
        calls = [];
        disableBeforeUpload = true;
        await request({ action: "cron" }, "", "cron-only");
        assert.equal(uploads, 1);
        assert.equal(row.automatic_enabled, false);
        disableBeforeUpload = false;
      },
    );
    await t.test(
      "revocación: detiene respaldos y solicita reconectar; desconectar elimina credenciales",
      async () => {
        row.automatic_enabled = true;
        revoked = true;
        const result = await (
          await request({ action: "cron" }, "", "cron-only")
        ).json();
        assert.equal(result.failed, 1);
        assert.equal(row.automatic_enabled, false);
        assert.equal(row.status, "reconnect_required");
        assert.equal((await request({ action: "token" })).status, 409);
        await request({ action: "disconnect" });
        assert.equal(row, null);
        assert.equal((await request({ action: "token" })).status, 409);
      },
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldDeno === undefined) delete globals.Deno;
    else globals.Deno = oldDeno;
  }
});
