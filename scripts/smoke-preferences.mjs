import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settingsSection } from "./settings-navigation.mjs";
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
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("qgasto:data:v1")).state);
const notices = async () => {
  while (await button("Cerrar notificación").count())
    await button("Cerrar notificación").click();
};
async function sampleFrames() {
  await page.evaluate(() => {
    window.__sheetFrames = [];
    const until = performance.now() + 2500;
    const frame = () => {
      const backdrop = document.querySelector('[data-testid="sheet-backdrop"]'),
        motion = document.querySelector('[data-testid="sheet-motion"]');
      if (backdrop && motion)
        window.__sheetFrames.push({
          opacity: Number(getComputedStyle(backdrop).opacity),
          y: new DOMMatrix(getComputedStyle(motion).transform).m42,
        });
      if (performance.now() < until) requestAnimationFrame(frame);
    };
    frame();
  });
}
try {
  const f = JSON.parse(readFileSync("examples/qgasto-datos-prueba.json")).data;
  f.accounts = [
    {
      id: "bank",
      name: "Banco",
      type: "bank",
      openingBalance: 200000,
      active: true,
    },
  ];
  f.events = [];
  f.goals = [];
  f.budgets = [];
  f.contributions = [];
  f.transfers = [];
  f.recurring = [
    {
      id: "loan",
      type: "installment",
      accountId: "bank",
      categoryId: "home",
      amount: 10000,
      note: "Compra saldada",
      active: false,
      startDate: "2026-01-01",
      nextDate: "2026-04-01",
      installments: {
        principal: 30000,
        interest: 0,
        count: 3,
        paid: 3,
        paidAmount: 30000,
      },
    },
    {
      id: "service",
      type: "expense",
      accountId: "bank",
      categoryId: "home",
      amount: 5000,
      note: "Servicio recurrente",
      active: true,
      startDate: "2026-11-01",
      nextDate: "2026-12-01",
    },
  ];
  f.transactions = [1, 2, 3].map((m) => ({
    id: `recurring:loan:2026-0${m}-01`,
    type: "expense",
    accountId: "bank",
    categoryId: "home",
    amount: 10000,
    date: `2026-0${m}-01`,
    note: "Cuota",
  }));
  f.transactions.push({
    id: "recurring:service:2026-11-01",
    type: "expense",
    accountId: "bank",
    categoryId: "home",
    amount: 5000,
    date: "2026-11-01",
    note: "Servicio",
  });
  await page.addInitScript((f) => {
    if (!localStorage.getItem("qgasto:data:v1"))
      localStorage.setItem(
        "qgasto:data:v1",
        JSON.stringify({ state: f, revision: 0, dirty: false }),
      );
  }, f);
  await page.goto(process.env.QGASTO_URL || "http://127.0.0.1:8081");
  await expect(page.getByTestId("launch-screen")).toHaveCount(0);
  await expect(page.getByTestId("app-lock-screen")).toHaveCount(0);
  await button("Abrir ajustes").click();
  for (const title of [
    "Apariencia",
    "Seguridad",
    "Categorías de gasto",
    "Copias de seguridad",
    "Créditos y licencias",
  ])
    await expect(button(title)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nombre de categoría" }),
  ).toHaveCount(0);
  await page.screenshot({ path: "/tmp/agendapp-011-settings-light.png" });
  await settingsSection(page, "Seguridad");
  const lock = page.getByRole("switch", {
    name: "Bloqueo por huella",
    exact: true,
  });
  await expect(lock).not.toBeChecked();
  await expect(lock).toBeDisabled();
  await expect(page.getByText("Desactivado", { exact: true })).toBeVisible();
  await expect(page.getByTestId("app-lock-screen")).toHaveCount(0);
  await settingsSection(page, "Apariencia");
  if (await button("Cambiar a modo nocturno").count())
    await button("Cambiar a modo nocturno").click();
  await notices();
  await button("Volver a Ajustes").click();
  await expect(button("Seguridad")).toBeVisible();
  await expect(page.getByTestId("settings-page")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/agendapp-011-settings-dark.png" });
  await settingsSection(page, "Copias de seguridad");
  await expect(button("Cargar copia de seguridad")).toBeVisible();
  await expect(lock).toHaveCount(0);
  await settingsSection(page, "Créditos y licencias");
  await button("Créditos y licencias").click();
  await expect(page.getByText("Inter", { exact: true })).toBeVisible();
  await tab("Planes").click();
  await expect(button("Quitar compra pagada")).toBeVisible();
  await sampleFrames();
  await button("Quitar compra pagada").click();
  const backdrop = page.getByTestId("sheet-backdrop");
  await expect(backdrop).toHaveCSS("opacity", "1");
  const frames = await page.evaluate(() => window.__sheetFrames);
  assert.ok(
    frames.some((f) => f.y > 2 && f.opacity === 0),
    "panel enters before dimming",
  );
  assert.ok(
    frames.every((f) => f.y <= 2 || f.opacity < 0.02),
    "backdrop stays clear during entry",
  );
  const bg = await backdrop.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  assert.ok(bg.includes("0.28"), "background is softer than the old 72% dim");
  await sampleFrames();
  await button("Cancelar").click();
  await expect(backdrop).toHaveCount(0);
  const exit = await page.evaluate(() => window.__sheetFrames);
  assert.ok(
    exit.some((f) => f.y > 2 && f.opacity < 0.9),
    "exit dims smoothly while panel leaves",
  );
  assert.equal((await state()).recurring[0].archived, undefined);
  await button("Quitar compra pagada").click();
  await button("Confirmar eliminación").click();
  await expect(button("Quitar compra pagada")).toHaveCount(0);
  await notices();
  let s = await state();
  assert.equal(s.recurring[0].archived, true);
  assert.equal(s.transactions.length, 4);
  await button("Eliminar recurrente").click();
  await button("Confirmar eliminación").click();
  await expect(button("Eliminar recurrente")).toHaveCount(0);
  await notices();
  s = await state();
  assert.equal(s.recurring[1].archived, true);
  assert.equal(s.transactions.length, 4);
  await page.reload();
  await tab("Planes").click();
  assert.equal((await state()).transactions.length, 4);
  await expect(button("Reanudar")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await button("Abrir ajustes").click();
  await settingsSection(page, "Seguridad");
  await expect(lock).not.toBeChecked();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: settings menu/details/back, web biometric off and unavailable, delayed softer backdrop and smooth exit, confirmed removal with preserved history and reload persistence.",
  );
} catch (e) {
  await page.screenshot({ path: "/tmp/agendapp-011-preferences-error.png" });
  throw e;
} finally {
  await browser.close();
}
