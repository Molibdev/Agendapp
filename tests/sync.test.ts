import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile, LocalSnapshot } from "../src/domain/sync";
import { initialState, apply, balance } from "../src/domain/finance";
import type { State } from "../src/domain/finance";
import type { RemoteSnapshot } from "../src/domain/sync";
const local: LocalSnapshot = { state: initialState, revision: 0, dirty: true };
test("sincroniza primera escritura conservando caché y revisión", async () => {
  const next = await reconcile(local, null, async (s, r) => {
    assert.equal(s, local.state);
    assert.equal(r, 0);
    return 1;
  });
  assert.equal(next.revision, 1);
  assert.equal(next.dirty, false);
  assert.equal(local.dirty, true);
});
test("conflicto entre dispositivos no sube ni modifica datos locales", async () => {
  let uploaded = false;
  await assert.rejects(
    () =>
      reconcile(local, { state: initialState, revision: 2 }, async () => {
        uploaded = true;
        return 3;
      }),
    /Conflicto/,
  );
  assert.equal(uploaded, false);
  assert.equal(local.revision, 0);
});
test("dispositivo sin cambios carga nube y no sobrescribe servidor", async () => {
  const next = await reconcile(
    { ...local, dirty: false },
    { state: initialState, revision: 4 },
    async () => {
      throw Error("No debería subir");
    },
  );
  assert.equal(next.revision, 4);
  assert.equal(next.dirty, false);
});
test("error de red conserva datos pendientes y detecta desaparición remota", async () => {
  await assert.rejects(
    () =>
      reconcile(local, null, async () => {
        throw Error("offline");
      }),
    /offline/,
  );
  assert.equal(local.dirty, true);
  await assert.rejects(
    () => reconcile({ ...local, revision: 5 }, null, async () => 6),
    /ya no existe/,
  );
});

// Two independent device copies with a server that enforces compare-and-swap.
// This models the protocol; it does not replace checks on physical devices.
const meeting = {
  id: "multi-device-event",
  title: "Prueba entre dispositivos",
  startsAt: "2026-11-02T09:00",
  endsAt: "2026-11-02T10:00",
  location: "Santiago",
  description: "Prueba",
  remindDayBefore: true,
  remindSameDay: false,
};
function testServer() {
  let remote: RemoteSnapshot | null = null;
  const read = () => (remote ? structuredClone(remote) : null);
  const push = async (state: State, revision: number) => {
    if ((remote?.revision ?? 0) !== revision)
      throw new Error("revision conflict");
    remote = { state: structuredClone(state), revision: revision + 1 };
    return remote.revision;
  };
  return {
    read,
    push,
    sync: (device: LocalSnapshot) => reconcile(device, read(), push),
  };
}
test("dos dispositivos: finanzas y Agenda viajan de A a B y sus ediciones vuelven a A", async () => {
  const server = testServer();
  let state = apply(initialState, {
    kind: "account",
    value: {
      id: "bank",
      name: "Cuenta de prueba",
      type: "bank",
      openingBalance: 1000,
      active: true,
    },
  });
  state = apply(state, {
    kind: "transaction",
    value: {
      id: "expense",
      type: "expense",
      accountId: "bank",
      categoryId: "food",
      amount: 100,
      date: "2026-11-02",
      note: "Prueba",
    },
  });
  state = apply(state, { kind: "event", value: meeting });
  let a = await server.sync({ state, revision: 0, dirty: true });
  let b = await server.sync({ state: initialState, revision: 0, dirty: false });
  assert.deepEqual(b.state, a.state);
  b = await server.sync({
    ...b,
    dirty: true,
    state: apply(b.state, {
      kind: "update-transaction",
      value: { ...b.state.transactions[0], amount: 200 },
    }),
  });
  a = await server.sync(a);
  assert.equal(balance(a.state, "bank"), 800);
  assert.equal(a.revision, b.revision);
  b = await server.sync({
    ...b,
    dirty: true,
    state: apply(b.state, {
      kind: "update-event",
      value: { ...meeting, location: "Oficina B" },
    }),
  });
  a = await server.sync(a);
  assert.equal(a.state.events[0].location, "Oficina B");
  b = await server.sync({
    ...b,
    dirty: true,
    state: apply(b.state, { kind: "delete-event", id: meeting.id }),
  });
  a = await server.sync(a);
  assert.equal(a.state.events.length, 0);
  assert.equal(a.state.transactions[0].amount, 200);
  assert.equal(a.dirty, false);
});
test("edición sin conexión conserva pendientes y detecta conflicto al reencontrar cambios de B", async () => {
  const server = testServer();
  let a = await server.sync({
    state: apply(initialState, { kind: "event", value: meeting }),
    revision: 0,
    dirty: true,
  });
  let b = await server.sync({ state: initialState, revision: 0, dirty: false });
  a = {
    ...a,
    dirty: true,
    state: apply(a.state, {
      kind: "update-event",
      value: { ...meeting, title: "Edición offline A" },
    }),
  };
  const pending = structuredClone(a);
  await assert.rejects(
    reconcile(a, server.read(), async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  assert.equal(server.read()!.revision, a.revision);
  assert.deepEqual(a, pending);
  b = await server.sync({
    ...b,
    dirty: true,
    state: apply(b.state, {
      kind: "update-event",
      value: { ...meeting, title: "Edición online B" },
    }),
  });
  await assert.rejects(server.sync(a), /Conflicto/);
  assert.deepEqual(a, pending);
  assert.equal(server.read()!.state.events[0].title, "Edición online B");
  assert.equal(a.state.events[0].title, "Edición offline A");
  assert.equal(a.dirty, true);
  assert.equal(b.dirty, false);
});
test("dos escrituras concurrentes de la misma revisión: solo una se acepta", async () => {
  const server = testServer();
  const base = await server.sync({
    state: apply(initialState, { kind: "event", value: meeting }),
    revision: 0,
    dirty: true,
  });
  const snapshot = server.read();
  const a = {
    ...base,
    dirty: true,
    state: apply(base.state, {
      kind: "update-event",
      value: { ...meeting, title: "Cambio A" },
    }),
  };
  const b = {
    ...base,
    dirty: true,
    state: apply(base.state, {
      kind: "update-event",
      value: { ...meeting, title: "Cambio B" },
    }),
  };
  const results = await Promise.allSettled([
    reconcile(a, snapshot, server.push),
    reconcile(b, snapshot, server.push),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal(server.read()!.revision, base.revision + 1);
  assert.equal(a.dirty, true);
  assert.equal(b.dirty, true);
});
