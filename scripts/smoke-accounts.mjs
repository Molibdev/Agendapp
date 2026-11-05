import { settingsSection } from "./settings-navigation.mjs";
// Full browser flow against a local build and mocked Supabase endpoints.
// Does not send email, authenticate real accounts or touch a remote database.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const output = mkdtempSync(join(tmpdir(), "agendapp-accounts-"));
let browser, server, page;
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
        EXPO_PUBLIC_SUPABASE_URL: "https://account-test.invalid",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-browser-fixture",
        EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED: "true",
      },
    },
  );
  server = createServer((req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(
      output,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(output + "/")) {
      res.writeHead(403).end();
      return;
    }
    try {
      res.setHeader(
        "Content-Type",
        {
          ".js": "application/javascript",
          ".html": "text/html",
          ".png": "image/png",
          ".json": "application/json",
          ".ico": "image/x-icon",
        }[extname(file)] ?? "application/octet-stream",
      );
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(10000);
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url"),
    "fixture-signature",
  ].join(".");
  const session = () => ({
    access_token: jwt,
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_in: 3600,
    user,
  });
  let recoverRedirect = "",
    challenge = "",
    confirmationRedirect = "",
    confirmationChallenge = "",
    updated = "",
    logoutCalls = 0,
    remote = null,
    blockSync = false;
  const drive = {
    connected: true,
    automatic_enabled: false,
    last_backup_at: null,
    status: "connected",
  };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://account-test.invalid/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const json = (status, body) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    const body = request.postData() ? JSON.parse(request.postData()) : null;
    if (url.pathname === "/functions/v1/drive-service") {
      assert.equal(request.headers().authorization, `Bearer ${jwt}`);
      if (body.action === "status") return json(200, drive);
      if (body.action === "token")
        return json(200, { access_token: "drive-browser-fixture" });
      if (body.action === "preferences") {
        assert.equal(typeof body.enabled, "boolean");
        drive.automatic_enabled = body.enabled;
        return json(200, { automatic_enabled: body.enabled });
      }
      if (body.action === "disconnect") {
        drive.connected = false;
        drive.automatic_enabled = false;
        return json(200, { connected: false });
      }
      throw new Error("Unexpected drive action: " + body.action);
    }
    if (url.pathname === "/auth/v1/recover") {
      assert.equal(body.email, user.email);
      assert.ok(body.code_challenge);
      recoverRedirect = url.searchParams.get("redirect_to");
      challenge = body.code_challenge;
      return json(200, {});
    }
    if (url.pathname === "/auth/v1/resend") {
      assert.equal(body.type, "signup");
      confirmationRedirect = url.searchParams.get("redirect_to");
      confirmationChallenge = body.code_challenge;
      return json(200, {});
    }
    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "pkce") {
        assert.ok(
          ["fixture-code", "confirmation-code"].includes(body.auth_code),
        );
        assert.equal(
          createHash("sha256").update(body.code_verifier).digest("base64url"),
          body.auth_code === "confirmation-code"
            ? confirmationChallenge
            : challenge,
        );
      } else if (url.searchParams.get("grant_type") === "password") {
        assert.equal(body.password, "new-password-123");
      }
      return json(200, session());
    }
    if (url.pathname === "/auth/v1/user") {
      if (request.method() === "PUT") {
        updated = body.password;
        assert.equal(updated, "new-password-123");
      }
      return json(200, user);
    }
    if (url.pathname === "/auth/v1/logout") {
      assert.equal(url.searchParams.get("scope"), "local");
      logoutCalls++;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/rest/v1/finance_snapshots") {
      if (blockSync) return json(403, { message: "sync unavailable fixture" });
      if (request.method() === "GET") return json(200, remote);
      assert.equal(body.user_id ?? user.id, user.id);
      remote = { data: body.data, revision: body.revision };
      return json(200, { revision: remote.revision });
    }
    throw new Error("Unexpected mocked endpoint: " + url.pathname);
  });
  await page.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    assert.equal(
      request.headers().authorization,
      "Bearer drive-browser-fixture",
    );
    if (url.pathname === "/drive/v3/files")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          files: [{ id: "backup-fixture", name: "Agendapp-auto-fixture.json" }],
        }),
      });
    if (
      url.pathname === "/drive/v3/files/backup-fixture" &&
      url.searchParams.get("alt") === "media"
    )
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: readFileSync("examples/qgasto-datos-prueba.json", "utf8"),
      });
    throw new Error("Unexpected Drive fixture endpoint: " + url.pathname);
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const field = (name) => page.getByRole("textbox", { name, exact: true });
  const profile = async () => {
    await page
      .getByRole("button", { name: /^(Abrir|Cerrar) perfil$/ })
      .waitFor();
    if (await button("Abrir perfil").count())
      await button("Abrir perfil").click();
  };
  const settings = async () => {
    if (await button("Abrir ajustes").count())
      await button("Abrir ajustes").click();
  };
  await page.goto(origin);
  await profile();
  await button("Olvidé mi contraseña").click();
  await expect(
    page.getByText("Introduce un correo electrónico válido.", { exact: true }),
  ).toBeVisible();
  await field("Correo electrónico").fill(user.email);
  await button("Reenviar confirmación").click();
  await expect(
    page.getByText(
      /^Si el correo corresponde a una cuenta que lo necesita.*\.$/,
    ),
  ).toBeVisible();
  await button("Olvidé mi contraseña").click();
  await expect.poll(() => recoverRedirect).not.toBe("");
  const callback = new URL(recoverRedirect);
  callback.searchParams.set("code", "fixture-code");
  await page.goto(callback.href);
  await expect(field("Nueva contraseña")).toBeVisible();
  await field("Nueva contraseña").fill("new-password-123");
  await field("Repetir contraseña").fill("different-123");
  await button("Guardar nueva contraseña").click();
  await expect(
    page.getByText("Las contraseñas no coinciden.", { exact: true }),
  ).toBeVisible();
  assert.equal(updated, "");
  // A reload during recovery must preserve the recovery screen.
  await page.reload();
  await expect(field("Nueva contraseña")).toBeVisible();
  await field("Nueva contraseña").fill("new-password-123");
  await field("Repetir contraseña").fill("new-password-123");
  await button("Guardar nueva contraseña").click();
  await expect(button("Entendido")).toBeVisible();
  await button("Entendido").click();
  assert.equal(updated, "new-password-123");
  await page.reload();
  await profile();
  await expect(button("Cerrar sesión")).toBeVisible();
  const daily = page.getByRole("switch", {
    name: "Activar respaldo diario",
    exact: true,
  });
  await expect(daily).toBeEnabled();
  while (await button("Cerrar notificación").count())
    await button("Cerrar notificación").click();
  // Controlled value is updated after the server confirms the preference.
  await daily.click();
  await expect(daily).toBeChecked();
  await expect(
    page.getByText("Respaldo diario activado ✓", { exact: true }),
  ).toBeVisible();
  await button("Cerrar notificación").click();
  await daily.click();
  await expect(daily).not.toBeChecked();
  assert.equal(drive.automatic_enabled, false);
  await button("Ver copias de Drive").click();
  await button("Restaurar esta copia").click();
  await expect(
    page.getByText("Restaurar copia de Drive", { exact: true }),
  ).toBeVisible();
  await expect(button("Confirmar restauración")).toBeVisible();
  await button("Cancelar restauración").click();
  await expect(button("Confirmar restauración")).toHaveCount(0);
  await expect(
    page.getByText(
      "Revisa los datos y confirma la restauración debajo de Google Drive.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page.screenshot({
    path: join(tmpdir(), "agendapp-redesign-profile-connected.png"),
  });
  await settings();
  await expect(
    page.getByText("Cuenta y sincronización", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Google Drive", { exact: true })).toHaveCount(0);
  await settingsSection(page, "Categorías de gasto");
  await field("Nombre de categoría").fill("Cuenta de prueba");
  await button("Agregar categoría").click();
  await expect(
    page.getByText("Categoría guardada", { exact: true }),
  ).toBeVisible();
  const key = `qgasto:data:${user.id}`;
  const sentinel = await page.evaluate((key) => {
    const value = localStorage.getItem(key);
    localStorage.setItem("qgasto:data:v1", value);
    localStorage.setItem("qgasto:data:other-user", "other-profile");
    return value;
  }, key);
  assert.ok(sentinel);
  await profile();
  await button("Cerrar sesión").click();
  await expect(button("Entendido")).toBeVisible();
  await button("Entendido").click();
  assert.ok(await page.evaluate((k) => localStorage.getItem(k), key));
  await profile();
  await field("Correo electrónico").fill(user.email);
  await field("Contraseña").fill("new-password-123");
  await button("Iniciar sesión").click();
  await expect(button("Cerrar sesión")).toBeVisible();
  blockSync = true;
  await settings();
  await settingsSection(page, "Categorías de gasto");
  await field("Nombre de categoría").fill("Pendiente");
  await button("Agregar categoría").click();
  await expect(
    page.getByText("Categoría guardada", { exact: true }),
  ).toBeVisible();
  await profile();
  await button("Cerrar sesión y borrar copia local").click();
  await button("Confirmar cierre y borrado local").click();
  await expect(
    page.getByText(
      "No se pudo sincronizar. La copia local y la sesión se conservan. Revisa la conexión o los permisos antes de volver a intentarlo.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(logoutCalls, 1);
  assert.ok(await page.evaluate((k) => localStorage.getItem(k), key));
  blockSync = false;
  await button("Confirmar cierre y borrado local").click();
  await expect(button("Entendido")).toBeVisible();
  await button("Entendido").click();
  // Wait past the automatic sync timer to detect delayed writes recreating data.
  await page.waitForTimeout(2500);
  assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), null);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("qgasto:data:v1")),
    sentinel,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("qgasto:data:other-user")),
    "other-profile",
  );
  assert.equal(logoutCalls, 2);
  await profile();
  await field("Correo electrónico").fill(user.email);
  confirmationRedirect = "";
  await button("Reenviar confirmación").click();
  await expect.poll(() => confirmationRedirect).not.toBe("");
  const confirmed = new URL(confirmationRedirect);
  confirmed.searchParams.set("code", "confirmation-code");
  await page.goto(confirmed.href);
  await profile();
  await expect(button("Cerrar sesión")).toBeVisible();
  await expect(field("Nueva contraseña")).toHaveCount(0);
  await page.goto(origin + "/?error=access_denied&error_code=otp_expired");
  await expect(
    page.getByText(
      "El enlace de correo venció o fue rechazado. Solicita uno nuevo.",
      { exact: true },
    ),
  ).toBeVisible();
  await button("Entendido").click();
  await profile();
  await expect(button("Cerrar sesión")).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mocked recovery email + PKCE exchange + reload + password update; confirmation resend + callback; expired link; local-only signout; protected cleanup and other-profile preservation; Drive daily backup opt-in/out and floating feedback.",
  );
} catch (error) {
  if (page)
    await page.screenshot({
      path: join(tmpdir(), "agendapp-accounts-error.png"),
    });
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
  rmSync(output, { recursive: true, force: true });
}
