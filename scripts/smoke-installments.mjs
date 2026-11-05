import { settingsSection } from "./settings-navigation.mjs";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  timezoneId: "America/Santiago",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const field = (name) => page.getByRole("textbox", { name, exact: true });
const tab = (name) => page.getByRole("tab", { name, exact: true });
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("qgasto:data:v1")).state);
const clearNotices = async () => {
  while (await button("Cerrar notificación").count())
    await button("Cerrar notificación").click();
};
try {
  const f = JSON.parse(readFileSync("examples/qgasto-datos-prueba.json")).data;
  f.transactions = [];
  f.recurring = [];
  f.budgets = [];
  f.transfers = [];
  f.goals = [];
  f.contributions = [];
  f.events = [];
  f.accounts = [
    {
      id: "card",
      name: "Tarjeta de prueba",
      type: "credit",
      openingBalance: 0,
      creditLimit: 500000,
      active: true,
    },
  ];
  await page.clock.install({ time: new Date("2026-11-04T15:00:00Z") });
  await page.addInitScript((f) => {
    if (!localStorage.getItem("qgasto:data:v1"))
      localStorage.setItem(
        "qgasto:data:v1",
        JSON.stringify({ state: f, revision: 0, dirty: false }),
      );
    localStorage.setItem("qgasto:theme", "dark");
  }, f);
  await page.goto("http://127.0.0.1:8081");
  await tab("Planes").click();
  await button("+ Recurrente").click();
  await button("Compra en cuotas").click();
  await field("Número de cuotas").fill("3");
  await field("Número de cuotas").fill("3a");
  await expect(field("Número de cuotas")).toHaveValue("3");
  await field("Interés total CLP (0 sin interés)").fill("20000");
  const price = field("Precio total de compra CLP");
  await price.fill("100000");
  await price.fill("1e3");
  await expect(price).toHaveValue("100000");
  await price.fill("100.5");
  await expect(price).toHaveValue("100000");
  await button("Fecha").click();
  await field("Año del calendario").fill("abc");
  await expect(field("Año del calendario")).toHaveValue("2026");
  await button("Mes siguiente").click();
  await button("2026-12-04").click();
  await field("Nota (opcional)").fill("Computador en cuotas");
  await button("Guardar").click();
  await expect(button("Cancelar")).toHaveCount(0);
  await clearNotices();
  let s = await state();
  assert.equal(s.recurring[0].amount, 40000);
  assert.equal(s.recurring[0].installments.interest, 20000);
  assert.equal(s.transactions.length, 0);
  await page.clock.setSystemTime(new Date("2027-01-04T15:00:00Z"));
  await page.reload();
  await tab("Planes").click();
  await expect(
    page.getByText("2 de 3 cuotas cubiertas", { exact: true }),
  ).toBeVisible();
  await clearNotices();
  await button("Editar cuotas").click();
  await field("Número total de cuotas").fill("4");
  await button("Guardar").click();
  await expect(button("Cancelar")).toHaveCount(0);
  await clearNotices();
  s = await state();
  assert.equal(s.transactions.length, 2);
  assert.equal(s.recurring[0].amount, 20000);
  assert.equal(s.recurring[0].installments.count, 4);
  await button("Pagado con anterioridad").click();
  await button("Confirmar pago anticipado").click();
  await expect(button("Cancelar")).toHaveCount(0);
  await clearNotices();
  s = await state();
  assert.equal(s.transactions.length, 3);
  assert.equal(
    s.transactions.reduce((n, t) => n + t.amount, 0),
    120000,
  );
  assert.equal(s.recurring[0].active, false);
  await expect(page.getByText("PAGADO", { exact: true })).toBeVisible();
  await expect(button("Reanudar")).toHaveCount(0);
  await page.reload();
  s = await state();
  assert.equal(s.transactions.length, 3);
  await tab("Agenda").click();
  const fab = button("Crear evento");
  await expect(fab).toBeVisible();
  assert.equal((await fab.textContent()).trim(), "");
  const before = await fab.boundingBox();
  await page
    .getByText("Hora local del dispositivo", { exact: false })
    .scrollIntoViewIfNeeded();
  const after = await fab.boundingBox();
  assert.ok(Math.abs(before.y - after.y) < 1);
  await fab.click();
  await field("Título del evento").fill("Agenda renovada");
  await button("Guardar evento").click();
  await clearNotices();
  await page.getByText("TU AGENDA", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/agendapp-010-agenda-dark.png" });
  await button("Información de Agendapp").dblclick({ delay: 70 });
  await expect(page.getByTestId("floating-feedback")).toContainText(
    `Versión: ${JSON.parse(readFileSync("app.json")).expo.version}`,
  );
  await clearNotices();
  await button("Abrir ajustes").click();
  await settingsSection(page, "Apariencia");
  await button("Cambiar a modo claro").click();
  await clearNotices();
  await button("Cerrar ajustes").click();
  await tab("Agenda").click();
  await page.screenshot({ path: "/tmp/agendapp-010-agenda-light.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: numeric-only edits, future purchase with interest, monthly posting, resize, early payoff, persisted totals, current version and floating calendar action in both themes.",
  );
} catch (e) {
  await page.screenshot({ path: "/tmp/agendapp-010-installments-error.png" });
  throw e;
} finally {
  await browser.close();
}
