// Local UI checks only: normal/reduced launch, bottom dock, gestures and transitions.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const tab = (name) => page.getByRole("tab", { name, exact: true });
const notice = () => page.getByTestId("floating-feedback");
const fixture = JSON.parse(
  readFileSync("examples/qgasto-datos-prueba.json", "utf8"),
).data;
fixture.recurring = [];
const version = JSON.parse(readFileSync("app.json", "utf8")).expo.version;
const about = `Desarrollado por Molibdev utilizando Codex (GPT-5.6 Sol).\nVersión: ${version}`;
try {
  await page.addInitScript((fixture) => {
    localStorage.setItem("qgasto:theme", "dark");
    localStorage.setItem(
      "qgasto:data:v1",
      JSON.stringify({ state: fixture, revision: 0, dirty: false }),
    );
  }, fixture);
  await page.goto(process.env.QGASTO_URL || "http://127.0.0.1:8081", {
    waitUntil: "domcontentloaded",
  });
  const launch = page.getByTestId("launch-screen");
  await expect(launch).toBeVisible();
  const started = Date.now();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/agendapp-launch-animated.png" });
  await expect(launch).toHaveCount(0, { timeout: 2500 });
  assert.ok(
    Date.now() - started < 2500,
    "added launch animation stays under 2.5 seconds",
  );
  const dock = page.getByTestId("bottom-navigation"),
    dockBox = await dock.boundingBox(),
    action = await button("Registrar gasto").boundingBox();
  assert.ok(dockBox.y > 844 * 0.75, "navigation is at the bottom");
  assert.ok(
    action.y + action.height <= dockBox.y - 10,
    "plus sits above the dock with a clear gap",
  );
  assert.equal(await page.getByRole("tab").count(), 5);
  for (const name of ["Inicio", "Cuentas", "Actividad", "Planes", "Agenda"]) {
    assert.equal(
      (await tab(name).textContent()).trim(),
      "",
      "tabs use icons, accessible names remain available",
    );
    const b = await tab(name).boundingBox();
    assert.ok(b.width >= 44 && b.height >= 44);
  }
  const brand = button("Información de Agendapp");
  await brand.click();
  await expect(notice()).toHaveCount(0);
  await page.waitForTimeout(400);
  await brand.dblclick({ delay: 70 });
  await expect(notice()).toContainText(about);
  assert.ok((await notice().textContent()).includes(`Versión: ${version} i`));
  await button("Cerrar notificación").click();
  await brand.focus();
  await page.keyboard.press("Enter");
  await expect(notice()).toContainText(about);
  await button("Cerrar notificación").click();
  await page.waitForTimeout(400);
  await brand.tap();
  await expect(notice()).toHaveCount(0);
  await brand.tap();
  await expect(notice()).toContainText(about);
  await button("Cerrar notificación").click();
  await page.screenshot({ path: "/tmp/agendapp-branding-home-dark.png" });
  // A request during an entry animation must neither freeze nor blank the content.
  await button("Abrir ajustes").click();
  await expect(page.getByText("Apariencia", { exact: true })).toBeVisible();
  await button("Abrir perfil").click();
  await expect(
    page.getByText("Cuenta y sincronización", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("section-content")).toHaveCSS("opacity", "1");
  await button("Cerrar perfil").click();
  await expect(tab("Inicio")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("section-content")).toHaveCSS("opacity", "1");
  await button("Abrir ajustes").click();
  await button("Cerrar ajustes").click();
  await expect(page.getByTestId("section-content")).toHaveCSS("opacity", "1");
  await button("Abrir ajustes").click();
  await button("Cambiar a modo claro").click();
  await expect(notice()).toContainText("Modo claro activado ✓");
  await expect(notice()).toHaveCSS("opacity", "1");
  const compact = await notice().boundingBox();
  assert.ok(compact.height <= 64, "short notices stay compact");
  await button("Cerrar notificación").click();
  await button("Cerrar ajustes").click();
  await expect(page.getByTestId("section-content")).toHaveCSS("opacity", "1");
  await button("Registrar gasto").click();
  await button("Guardar").click();
  await expect(notice()).toContainText("Escribe un monto entero");
  assert.ok(
    (await notice().textContent()).trim().endsWith("×"),
    "error indicator follows the message",
  );
  await expect(notice()).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/agendapp-compact-error.png" });
  await button("Cerrar notificación").click();
  await button("Cancelar").click();
  await page.screenshot({ path: "/tmp/agendapp-branding-home-light.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("launch-screen")).toHaveCount(0, {
    timeout: 1500,
  });
  await expect(button("Abrir ajustes")).toBeVisible();
  await button("Abrir ajustes").click();
  await button("Cerrar ajustes").click();
  await expect(tab("Inicio")).toHaveAttribute("aria-selected", "true");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: launch <2.5s, reduced motion, icon-only bottom tabs, separated plus, double-tap credits/version, compact trailing indicators and interruptible menu transitions.",
  );
} finally {
  await browser.close();
}
