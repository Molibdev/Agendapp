import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agendaReminders,
  reminderPlan,
  reminderFingerprint,
} from "../src/domain/reminders";
import {
  seal,
  unseal,
  refreshGoogle,
  stripGoogleRefresh,
} from "../supabase/functions/drive-service/core";
import {
  registerFeedbackHost,
  feedbackSnapshot,
  dismissFeedback,
  subscribeFeedback,
  notify,
} from "../src/data/feedback";
const event = {
  id: "e",
  title: "Reunión",
  startsAt: "2027-06-15T10:00",
  endsAt: "2027-06-15T11:00",
  location: "Sala",
  description: "",
  remindDayBefore: true,
  remindSameDay: true,
};
test("recordatorios futuros: día previo a la misma hora local y mismo día; cancelados y pasados se excluyen", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/Santiago";
  try {
    const reminders = agendaReminders(
      [event],
      "a",
      new Date("2027-06-01").valueOf(),
    );
    assert.equal(reminders.length, 2);
    assert.equal(reminders[0].date.getDate(), 14);
    assert.equal(reminders[0].date.getHours(), 10);
    assert.equal(reminders[1].date.getDate(), 15);
    assert.notEqual(reminders[0].id, reminders[1].id);
    assert.notEqual(reminders[0].id, agendaReminders([event], "b", 0)[0].id);
    assert.equal(
      agendaReminders([event], "a", new Date("2028-01-01").valueOf()).length,
      0,
    );
    assert.equal(
      agendaReminders(
        [{ ...event, remindDayBefore: false, remindSameDay: false }],
        "a",
        0,
      ).length,
      0,
    );
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("cifrado autenticado no permite intercambiar tokens entre usuarios o claves", async () => {
  const key = Buffer.alloc(32, 1).toString("base64");
  const cipher = await seal("refresh-fixture", "a", key);
  assert.equal(cipher.includes("refresh-fixture"), false);
  assert.equal(await unseal(cipher, "a", key), "refresh-fixture");
  await assert.rejects(unseal(cipher, "b", key));
  await assert.rejects(
    unseal(cipher, "a", Buffer.alloc(32, 2).toString("base64")),
  );
  assert.notEqual(await seal("refresh-fixture", "a", key), cipher);
});
test("renueva Google sin exponer el refresh token y clasifica revocación", async () => {
  const token = await refreshGoogle(
    "refresh-fixture",
    "client",
    "secret",
    async (url, init) => {
      assert.equal(String(url), "https://oauth2.googleapis.com/token");
      assert.equal(
        new URLSearchParams(init!.body as URLSearchParams).get("grant_type"),
        "refresh_token",
      );
      return new Response(JSON.stringify({ access_token: "access-fixture" }));
    },
  );
  assert.equal(token.access_token, "access-fixture");
  await assert.rejects(
    refreshGoogle(
      "refresh",
      "client",
      "secret",
      async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
        }),
    ),
    /GOOGLE_RECONNECT/,
  );
});
test("fallos de configuración Google no se clasifican como permiso revocado", async () => {
  await assert.rejects(
    refreshGoogle(
      "token",
      "client",
      "bad-secret",
      async () =>
        new Response(JSON.stringify({ error: "invalid_client" }), {
          status: 400,
        }),
    ),
    /GOOGLE_UNAVAILABLE/,
  );
});
test("la persistencia no guarda el refresh de Google pero mantiene la sesión Supabase", () => {
  const value = JSON.parse(
    stripGoogleRefresh(
      JSON.stringify({
        access_token: "supabase-access",
        refresh_token: "supabase-refresh",
        provider_refresh_token: "google-refresh",
      }),
    ),
  );
  assert.equal(value.refresh_token, "supabase-refresh");
  assert.equal(value.provider_refresh_token, undefined);
  assert.equal(stripGoogleRefresh("verifier"), "verifier");
});
test("avisos deduplican sync pero conservan acciones independientes", () => {
  const messages: unknown[] = [];
  const remove = subscribeFeedback((e) => messages.push(e));
  notify("sync", "success", "test-sync");
  notify("sync", "success", "test-sync");
  notify("evento");
  notify("evento");
  remove();
  assert.equal(messages.length, 3);
});

test("avisos comparten una sola cola al abrir o cerrar un editor", () => {
  while (feedbackSnapshot().messages.length) dismissFeedback();
  const root = registerFeedbackHost("root", 0);
  notify("Gasto registrado");
  const modal = registerFeedbackHost("editor", 1);
  assert.equal(feedbackSnapshot().host, "editor");
  const otherRoot = registerFeedbackHost("other-root", 0);
  assert.equal(feedbackSnapshot().host, "editor");
  modal();
  assert.equal(feedbackSnapshot().messages[0].message, "Gasto registrado");
  dismissFeedback();
  assert.equal(feedbackSnapshot().messages.length, 0);
  otherRoot();
  root();
});

test("agenda reprograma ediciones, cancela eliminados/al cerrar sesión y conserva avisos ajenos", () => {
  const wanted = agendaReminders([event], "a", 0);
  const scheduled = wanted.map((r) => ({
    identifier: r.id,
    content: {
      data: { source: "agendapp-agenda", fingerprint: reminderFingerprint(r) },
    },
  }));
  scheduled.push({
    identifier: "another-feature",
    content: { data: { source: "another-feature", fingerprint: "" } },
  });
  assert.deepEqual(reminderPlan(wanted, scheduled), {
    cancel: [],
    schedule: [],
  });
  const edited = agendaReminders(
    [{ ...event, title: "Nuevo título", startsAt: "2027-06-16T12:00" }],
    "a",
    0,
  );
  const changes = reminderPlan(edited, scheduled);
  assert.deepEqual(
    changes.cancel,
    wanted.map((r) => r.id),
  );
  assert.deepEqual(changes.schedule, edited);
  assert.equal(reminderPlan([], scheduled).cancel.length, 2);
  const profile = reminderPlan(agendaReminders([event], "b", 0), scheduled);
  assert.deepEqual(
    profile.cancel,
    wanted.map((r) => r.id),
  );
  assert.ok(profile.schedule.every((r) => r.owner === "b"));
});
