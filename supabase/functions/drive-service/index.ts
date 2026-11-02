// Deploy with JWT verification disabled at the gateway; every user request is
// verified with Auth /user below, and cron has a separate server-only secret.
import { seal, unseal, refreshGoogle } from "./core.ts";
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error("SERVER_NOT_CONFIGURED");
  return value;
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
async function db(
  path: string,
  method = "GET",
  body?: unknown,
  prefer = "return=representation",
) {
  const r = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"),
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error("DATABASE_ERROR");
  return r.status === 204 ? null : r.json();
}
async function access(row: any) {
  return refreshGoogle(
    await unseal(
      row.encrypted_refresh,
      row.user_id,
      env("DRIVE_ENCRYPTION_KEY"),
    ),
    env("GOOGLE_CLIENT_ID"),
    env("GOOGLE_CLIENT_SECRET"),
  );
}
async function google(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch("https://www.googleapis.com/" + path, {
    ...init,
    headers: { ...init.headers, Authorization: "Bearer " + token },
  });
  if (!r.ok)
    throw new Error(r.status === 401 ? "GOOGLE_RECONNECT" : "DRIVE_ERROR");
  return r;
}
async function backup(row: any) {
  const today = new Date().toISOString().slice(0, 10),
    uid = row.user_id;
  const [snapshot] = await db(
    `finance_snapshots?user_id=eq.${uid}&select=data,revision`,
  );
  if (!snapshot) {
    await db(`drive_connections?user_id=eq.${uid}`, "PATCH", {
      next_backup_at: new Date(Date.now() + 3600000).toISOString(),
      status: "waiting_for_sync",
    });
    return;
  }
  // Respect a preference change or disconnection made after this run was leased.
  const [current] = await db(`drive_connections?user_id=eq.${uid}`);
  if (!current?.automatic_enabled) return;
  const token = (await access(current)).access_token;
  let [run] = await db(
    `drive_backup_runs?user_id=eq.${uid}&backup_day=eq.${today}`,
  );
  if (!run) {
    const ids = await (
      await google(token, "drive/v3/files/generateIds?count=1&space=drive")
    ).json();
    await db(
      "drive_backup_runs",
      "POST",
      { user_id: uid, backup_day: today, file_id: ids.ids[0] },
      "resolution=ignore-duplicates,return=representation",
    );
    [run] = await db(
      `drive_backup_runs?user_id=eq.${uid}&backup_day=eq.${today}`,
    );
  }
  if (!run.completed) {
    const probe = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(run.file_id)}?fields=id`,
      { headers: { Authorization: "Bearer " + token } },
    );
    if (probe.status === 404) {
      const [active] = await db(`drive_connections?user_id=eq.${uid}`);
      if (!active?.automatic_enabled) return;
      const boundary = "agendapp_" + crypto.randomUUID();
      const content = JSON.stringify({
        format: "qgasto-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        data: snapshot.data,
      });
      if (new TextEncoder().encode(content).length > 10485760)
        throw new Error("BACKUP_TOO_LARGE");
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ id: run.file_id, name: `Agendapp-auto-${today}.json`, mimeType: "application/json", appProperties: { app: "qgasto", format: "backup-v1" } })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
      const sent = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      if (!sent.ok && sent.status !== 409)
        throw new Error("BACKUP_UPLOAD_FAILED");
      // A lost response or concurrent request is retried with the SAME reserved ID.
    } else if (!probe.ok) throw new Error("DRIVE_ERROR");
    const confirmed = await google(
      token,
      `drive/v3/files/${encodeURIComponent(run.file_id)}?fields=id`,
    );
    await confirmed.json();
    await db(
      `drive_backup_runs?user_id=eq.${uid}&backup_day=eq.${today}`,
      "PATCH",
      { completed: true },
    );
  }
  await db(`drive_connections?user_id=eq.${uid}`, "PATCH", {
    last_backup_at: new Date().toISOString(),
    next_backup_at: new Date(Date.now() + 86400000).toISOString(),
    status: "connected",
    updated_at: new Date().toISOString(),
  });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const input = await req.json();
    if (input.action === "cron") {
      const expected = env("BACKUP_CRON_SECRET"),
        given = req.headers.get("x-agendapp-cron-secret") ?? "";
      const digest = async (s: string) =>
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
        );
      const a = await digest(expected),
        b = await digest(given);
      if (a.some((v, i) => v !== b[i]))
        return reply({ error: "UNAUTHORIZED" }, 401);
      const now = new Date().toISOString();
      const rows = await db(
        `drive_connections?automatic_enabled=eq.true&next_backup_at=lte.${encodeURIComponent(now)}&order=next_backup_at.asc&limit=20`,
      );
      let done = 0,
        failed = 0;
      for (const row of rows) {
        const claimed = await db(
          `drive_connections?user_id=eq.${row.user_id}&automatic_enabled=eq.true&next_backup_at=lte.${encodeURIComponent(now)}`,
          "PATCH",
          { next_backup_at: new Date(Date.now() + 900000).toISOString() },
        );
        if (!claimed.length) continue;
        try {
          await backup(row);
          done++;
        } catch (e) {
          failed++;
          const reconnect =
            e instanceof Error && e.message === "GOOGLE_RECONNECT";
          await db(`drive_connections?user_id=eq.${row.user_id}`, "PATCH", {
            status: reconnect ? "reconnect_required" : "backup_failed",
            ...(reconnect ? { automatic_enabled: false } : {}),
            next_backup_at: new Date(Date.now() + 3600000).toISOString(),
          });
        }
      }
      return reply({ done, failed });
    }
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return reply({ error: "UNAUTHORIZED" }, 401);
    const checked = await fetch(env("SUPABASE_URL") + "/auth/v1/user", {
      headers: {
        Authorization: authorization,
        apikey: env("SUPABASE_ANON_KEY"),
      },
    });
    if (!checked.ok) return reply({ error: "UNAUTHORIZED" }, 401);
    const user = await checked.json(),
      uid = user.id;
    if (!uid) return reply({ error: "UNAUTHORIZED" }, 401);
    const [row] = await db(`drive_connections?user_id=eq.${uid}`);
    if (input.action === "status")
      return reply({
        connected: !!row,
        automatic_enabled: row?.automatic_enabled ?? false,
        last_backup_at: row?.last_backup_at ?? null,
        status: row?.status ?? "disconnected",
      });
    if (input.action === "connect") {
      if (
        typeof input.refresh_token !== "string" ||
        input.refresh_token.length > 4096 ||
        !input.refresh_token
      )
        return reply({ error: "INVALID_GRANT" }, 400);
      const token = await refreshGoogle(
        input.refresh_token,
        env("GOOGLE_CLIENT_ID"),
        env("GOOGLE_CLIENT_SECRET"),
      );
      await google(token.access_token, "drive/v3/about?fields=user");
      await db(
        "drive_connections",
        "POST",
        {
          user_id: uid,
          encrypted_refresh: await seal(
            input.refresh_token,
            uid,
            env("DRIVE_ENCRYPTION_KEY"),
          ),
          automatic_enabled: row?.automatic_enabled ?? false,
          status: "connected",
          updated_at: new Date().toISOString(),
        },
        "resolution=merge-duplicates,return=representation",
      );
      return reply({ connected: true });
    }
    if (!row) return reply({ error: "GOOGLE_RECONNECT" }, 409);
    if (input.action === "token")
      return reply({ access_token: (await access(row)).access_token });
    if (input.action === "preferences") {
      if (typeof input.enabled !== "boolean")
        return reply({ error: "INVALID_PREFERENCE" }, 400);
      if (input.enabled) await access(row);
      await db(`drive_connections?user_id=eq.${uid}`, "PATCH", {
        automatic_enabled: input.enabled,
        next_backup_at: new Date().toISOString(),
      });
      return reply({ automatic_enabled: input.enabled });
    }
    if (input.action === "disconnect") {
      await db(`drive_connections?user_id=eq.${uid}`, "DELETE");
      return reply({ connected: false });
    }
    return reply({ error: "INVALID_ACTION" }, 400);
  } catch (e) {
    const code = e instanceof Error ? e.message : "SERVER_ERROR";
    return reply(
      {
        error: [
          "GOOGLE_RECONNECT",
          "SERVER_NOT_CONFIGURED",
          "BACKUP_TOO_LARGE",
        ].includes(code)
          ? code
          : "DRIVE_SERVICE_FAILED",
      },
      code === "GOOGLE_RECONNECT" ? 409 : 503,
    );
  }
});
