import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountEmail,
  accountPassword,
  requestAccountEmail,
  updateRecoveredPassword,
  validRecoveryMarker,
  nativeAuthCode,
  logoutProfile,
  AccountAuth,
} from "../src/data/accountActions";
const auth: AccountAuth = {
  resetPasswordForEmail: async () => ({ error: null }),
  resend: async () => ({ error: null }),
  updateUser: async () => ({ error: null }),
};
test("correo normalizado y contraseña con confirmación y límites UTF-8", () => {
  assert.equal(accountEmail(" a@example.com "), "a@example.com");
  assert.throws(() => accountEmail("invalido"));
  assert.equal(accountPassword("clave-123", "clave-123"), "clave-123");
  assert.throws(() => accountPassword("corta", "corta"));
  assert.throws(() => accountPassword("clave-123", "otra-123"));
  assert.throws(() => accountPassword("é".repeat(37), "é".repeat(37)));
});
test("recuperación y confirmación envían el retorno a la app sin requerir contraseña", async () => {
  const calls: unknown[] = [];
  const port = {
    ...auth,
    resetPasswordForEmail: async (
      email: string,
      options: { redirectTo: string },
    ) => {
      calls.push([email, options]);
      return { error: null };
    },
    resend: async (options: Parameters<AccountAuth["resend"]>[0]) => {
      calls.push(options);
      return { error: null };
    },
  };
  const message = await requestAccountEmail(
    port,
    "recovery",
    " a@example.com ",
    "agendapp:///",
  );
  assert.deepEqual(calls[0], ["a@example.com", { redirectTo: "agendapp:///" }]);
  await requestAccountEmail(
    port,
    "confirmation",
    "a@example.com",
    "http://localhost:8081",
  );
  assert.deepEqual(calls[1], {
    type: "signup",
    email: "a@example.com",
    options: { emailRedirectTo: "http://localhost:8081" },
  });
  assert.match(message, /Si el correo corresponde/);
  await assert.rejects(
    requestAccountEmail(port, "recovery", "bad", "agendapp:///"),
    /válido/,
  );
  assert.equal(calls.length, 2);
});
test("errores de envío no revelan si la cuenta existe y explican límites", async () => {
  await assert.rejects(
    requestAccountEmail(
      {
        ...auth,
        resetPasswordForEmail: async () => ({
          error: { message: "User not found" },
        }),
      },
      "recovery",
      "a@example.com",
      "agendapp:///",
    ),
    (error: Error) =>
      !error.message.includes("User not found") &&
      error.message.includes("No pudimos"),
  );
  await assert.rejects(
    requestAccountEmail(
      {
        ...auth,
        resend: async () => ({ error: { message: "rate limit", status: 429 } }),
      },
      "confirmation",
      "a@example.com",
      "agendapp:///",
    ),
    /Espera/,
  );
});
test("nueva contraseña solo se envía si es válida y se informa sesión vencida", async () => {
  let sent = "";
  const port = {
    ...auth,
    updateUser: async (options: { password: string }) => {
      sent = options.password;
      return { error: null };
    },
  };
  await assert.rejects(updateRecoveredPassword(port, "corta", "corta"));
  assert.equal(sent, "");
  await updateRecoveredPassword(port, "clave-123", "clave-123");
  assert.equal(sent, "clave-123");
  await assert.rejects(
    updateRecoveredPassword(
      { ...auth, updateUser: async () => ({ error: { message: "expired" } }) },
      "clave-123",
      "clave-123",
    ),
    /nuevo enlace/,
  );
});
test("enlaces nativos solo aceptan los esquemas y raíz de la app, con PKCE flow ID", () => {
  assert.deepEqual(
    nativeAuthCode("agendapp:///?code=test-code&sb_flow_id=flow"),
    { code: "test-code", flowId: "flow" },
  );
  assert.deepEqual(nativeAuthCode("qgasto:///?code=old-code"), {
    code: "old-code",
    flowId: undefined,
  });
  for (const url of [
    "https://example.com/?code=bad",
    "agendapp://other/?code=bad",
    "agendapp:///other?code=bad",
    "exp+agendapp://expo-development-client/?url=code",
    "agendapp:///",
  ])
    assert.equal(nativeAuthCode(url), null);
  assert.throws(
    () => nativeAuthCode("agendapp:///?error=access_denied"),
    /venció/,
  );
});
test("recuperación persistida está ligada al usuario y caduca", () => {
  const raw = JSON.stringify({ userId: "a", expiresAt: 200 });
  assert.equal(validRecoveryMarker(raw, "a", 100), true);
  assert.equal(validRecoveryMarker(raw, "b", 100), false);
  assert.equal(validRecoveryMarker(raw, "a", 200), false);
  assert.equal(validRecoveryMarker("bad", "a", 100), false);
});
test("cierre normal conserva la copia y no necesita sincronización", async () => {
  let closed = false;
  await logoutProfile({
    forget: false,
    flush: async () => assert.fail(),
    read: async () => assert.fail(),
    remove: async () => assert.fail(),
    restore: async () => assert.fail(),
    signOut: async () => {
      closed = true;
    },
  });
  assert.equal(closed, true);
});
test("borrado local sincroniza primero y no toca otro perfil", async () => {
  const disk = new Map([
    ["a", "old-a"],
    ["b", "keep-b"],
    ["guest", "keep-guest"],
  ]);
  const order: string[] = [];
  await logoutProfile({
    forget: true,
    flush: async () => {
      order.push("sync");
      disk.set("a", "synced-a");
    },
    read: async () => disk.get("a") ?? null,
    remove: async () => {
      order.push("remove");
      disk.delete("a");
    },
    restore: async (raw) => {
      disk.set("a", raw);
    },
    signOut: async () => {
      order.push("signout");
    },
  });
  assert.deepEqual(order, ["sync", "remove", "signout"]);
  assert.equal(disk.has("a"), false);
  assert.equal(disk.get("b"), "keep-b");
  assert.equal(disk.get("guest"), "keep-guest");
});
test("sin conexión o con conflicto, no borra ni cierra la sesión", async () => {
  for (const message of ["offline", "Conflicto"]) {
    let removed = false,
      closed = false;
    await assert.rejects(
      logoutProfile({
        forget: true,
        flush: async () => {
          throw new Error(message);
        },
        read: async () => "data",
        remove: async () => {
          removed = true;
        },
        restore: async () => {},
        signOut: async () => {
          closed = true;
        },
      }),
    );
    assert.equal(removed, false);
    assert.equal(closed, false);
  }
});
test("si cerrar sesión falla, restaura exactamente la copia sincronizada", async () => {
  let value: string | null = "synced";
  await assert.rejects(
    logoutProfile({
      forget: true,
      flush: async () => {},
      read: async () => value,
      remove: async () => {
        value = null;
      },
      restore: async (raw) => {
        value = raw;
      },
      signOut: async () => {
        throw new Error("signout failed");
      },
    }),
    /signout failed/,
  );
  assert.equal(value, "synced");
});
