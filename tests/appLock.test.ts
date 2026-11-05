import { test } from "node:test";
import assert from "node:assert/strict";
import { AppLockController, type LockAdapter } from "../src/domain/appLock";
const flush = () => new Promise<void>((r) => setImmediate(r));
function fixture(stored = false) {
  const data = {
    stored,
    supported: true,
    result: true,
    reads: 0,
    writes: [] as boolean[],
    prompts: [] as string[],
    cancels: 0,
    readError: false,
    writeError: false,
    authError: false,
  };
  const adapter: LockAdapter = {
    supported: async () => data.supported,
    read: async () => {
      data.reads++;
      if (data.readError) throw Error("storage");
      return data.stored;
    },
    write: async (value) => {
      if (data.writeError) throw Error("storage");
      data.writes.push(value);
      data.stored = value;
    },
    authenticate: async (reason) => {
      data.prompts.push(reason);
      if (data.authError) throw Error("sensor");
      return data.result;
    },
    cancel: async () => {
      data.cancels++;
    },
  };
  return { data, adapter, controller: new AppLockController(adapter) };
}
test("first installation is off, unlocked, and never prompts or writes on its own", async () => {
  const { controller: c, data } = fixture();
  await c.load();
  assert.deepEqual(c.snapshot(), {
    loaded: true,
    enabled: false,
    unlocked: true,
    busy: false,
    error: "",
  });
  await c.unlock();
  c.background();
  c.foreground();
  await flush();
  assert.equal(data.prompts.length, 0);
  assert.deepEqual(data.writes, []);
});
test("only explicit opt-in plus successful authentication persists activation", async () => {
  const { controller: c, data } = fixture();
  await c.load();
  assert.equal(await c.setEnabled(true), true);
  assert.deepEqual(data.writes, [true]);
  assert.equal(data.stored, true);
  assert.equal(c.snapshot().unlocked, true);
});
test("unsupported fingerprint hardware or missing enrollment cannot enable protection", async () => {
  const { controller: c, data } = fixture();
  data.supported = false;
  await c.load();
  assert.equal(await c.setEnabled(true), false);
  assert.equal(c.snapshot().enabled, false);
  assert.equal(data.prompts.length, 0);
  assert.deepEqual(data.writes, []);
});
test("cancellation on opt-in never activates or writes a preference", async () => {
  const { controller: c, data } = fixture();
  data.result = false;
  await c.load();
  assert.equal(await c.setEnabled(true), false);
  assert.equal(c.snapshot().enabled, false);
  assert.equal(c.snapshot().unlocked, true);
  assert.deepEqual(data.writes, []);
});
test("an enabled installation stays locked if boot authentication is canceled", async () => {
  const { controller: c, data } = fixture(true);
  data.result = false;
  await c.load();
  assert.equal(c.snapshot().enabled, true);
  assert.equal(c.snapshot().unlocked, false);
  assert.equal(data.prompts.length, 1);
  assert.equal(data.stored, true);
  data.result = true;
  await c.unlock();
  assert.equal(c.snapshot().unlocked, true);
});
test("boot with enrolled fingerprint unavailable remains locked and does not clear the setting", async () => {
  const { controller: c, data } = fixture(true);
  data.supported = false;
  await c.load();
  assert.equal(c.snapshot().unlocked, false);
  assert.equal(c.snapshot().enabled, true);
  assert.equal(data.stored, true);
  assert.deepEqual(data.writes, []);
});
test("background locks immediately and foreground requires another successful prompt", async () => {
  const { controller: c, data } = fixture(true);
  await c.load();
  assert.equal(c.snapshot().unlocked, true);
  c.background();
  assert.equal(c.snapshot().unlocked, false);
  data.result = false;
  c.foreground();
  await flush();
  assert.equal(c.snapshot().unlocked, false);
  assert.equal(data.prompts.length, 2);
  data.result = true;
  await c.unlock();
  assert.equal(c.snapshot().unlocked, true);
});
test("disabling requires a fresh successful prompt; cancellation preserves protection", async () => {
  const { controller: c, data } = fixture(true);
  await c.load();
  data.result = false;
  assert.equal(await c.setEnabled(false), false);
  assert.equal(data.stored, true);
  data.result = true;
  assert.equal(await c.setEnabled(false), true);
  assert.equal(data.stored, false);
  assert.equal(c.snapshot().enabled, false);
  const count = data.prompts.length;
  c.background();
  c.foreground();
  await flush();
  assert.equal(data.prompts.length, count);
});
test("read failures fail closed, with an explicit retry instead of a silent disabled default", async () => {
  const { controller: c, data } = fixture(true);
  data.readError = true;
  await c.load();
  assert.equal(c.snapshot().loaded, false);
  assert.equal(c.snapshot().unlocked, false);
  data.readError = false;
  data.result = false;
  await c.load();
  assert.equal(c.snapshot().enabled, true);
  assert.equal(c.snapshot().unlocked, false);
});
test("write failure never reports enabled success or exposes content until preference is re-read", async () => {
  const { controller: c, data } = fixture();
  await c.load();
  data.writeError = true;
  assert.equal(await c.setEnabled(true), false);
  assert.equal(c.snapshot().loaded, false);
  assert.equal(c.snapshot().unlocked, false);
  assert.equal(data.stored, false);
  data.writeError = false;
  await c.load();
  assert.equal(c.snapshot().enabled, false);
  assert.equal(c.snapshot().unlocked, true);
});
test("ambiguous storage write is resolved by re-reading, never by assuming protection is off", async () => {
  const f = fixture();
  f.adapter.write = async (value) => {
    f.data.stored = value;
    throw Error("lost response");
  };
  const c = f.controller;
  await c.load();
  assert.equal(await c.setEnabled(true), false);
  assert.equal(c.snapshot().loaded, false);
  f.data.result = false;
  await c.load();
  assert.equal(c.snapshot().enabled, true);
  assert.equal(c.snapshot().unlocked, false);
});
test("sensor errors leave an enabled installation locked", async () => {
  const { controller: c, data } = fixture(true);
  data.authError = true;
  await c.load();
  assert.equal(c.snapshot().unlocked, false);
  assert.equal(c.snapshot().enabled, true);
  assert.equal(c.snapshot().busy, false);
});
test("concurrent startup loads do not start concurrent prompts", async () => {
  const f = fixture(true);
  let resolve!: (v: boolean) => void;
  f.adapter.authenticate = async (reason) => {
    f.data.prompts.push(reason);
    return new Promise<boolean>((r) => (resolve = r));
  };
  const a = f.controller.load(),
    b = f.controller.load();
  await flush();
  assert.equal(f.data.prompts.length, 1);
  resolve(true);
  await Promise.all([a, b]);
  assert.equal(f.controller.snapshot().unlocked, true);
});
test("authentication finishing after background cannot unlock or enable the app", async () => {
  const f = fixture();
  await f.controller.load();
  let resolve!: (v: boolean) => void;
  f.adapter.authenticate = () => new Promise<boolean>((r) => (resolve = r));
  const pending = f.controller.setEnabled(true);
  await flush();
  f.controller.background();
  resolve(true);
  assert.equal(await pending, false);
  assert.equal(f.data.stored, false);
  assert.equal(f.data.cancels, 1);
});
test("successful unlock arriving after background remains locked", async () => {
  const f = fixture(true);
  f.data.result = false;
  await f.controller.load();
  let resolve!: (v: boolean) => void;
  f.adapter.authenticate = () => new Promise<boolean>((r) => (resolve = r));
  const pending = f.controller.unlock();
  await flush();
  f.controller.background();
  resolve(true);
  await pending;
  assert.equal(f.controller.snapshot().unlocked, false);
  assert.equal(f.controller.snapshot().enabled, true);
});
test("opt-in finishing its storage write while backgrounded persists locked, not unlocked", async () => {
  const f = fixture();
  await f.controller.load();
  let resolve!: () => void;
  f.adapter.write = async (enabled) => {
    await new Promise<void>((r) => (resolve = r));
    f.data.stored = enabled;
  };
  const pending = f.controller.setEnabled(true);
  await flush();
  f.controller.background();
  resolve();
  await pending;
  assert.equal(f.data.stored, true);
  assert.equal(f.controller.snapshot().enabled, true);
  assert.equal(f.controller.snapshot().unlocked, false);
});
