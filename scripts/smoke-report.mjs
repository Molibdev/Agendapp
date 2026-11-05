import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settingsSection } from "./settings-navigation.mjs";

const fixturePath = "examples/agendapp-datos-prueba-v0.12.0.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const chooseFixture = async () => {
  const chooser = page.waitForEvent("filechooser");
  await button("Cargar copia de seguridad").click();
  await (await chooser).setFiles(fixturePath);
};

try {
  await page.goto(process.env.QGASTO_URL || "http://127.0.0.1:8081");
  await button("Abrir ajustes").click();
  await settingsSection(page, "Copias de seguridad");

  await chooseFixture();
  await expect(
    page.getByText(/4 cuentas, 89 movimientos, .*7 presupuestos/),
  ).toBeVisible();
  await expect(
    page.getByText(/6 pagos recurrentes o planes en cuotas/),
  ).toBeVisible();
  await expect(
    page.getByText(/3 compras en cuotas y 2 pagos retirados/),
  ).toBeVisible();
  await button("Cancelar restauración").click();
  const afterCancel = await page.evaluate(() =>
    localStorage.getItem("qgasto:data:v1"),
  );
  assert.ok(
    afterCancel === null || JSON.parse(afterCancel).state.accounts.length === 0,
  );

  await chooseFixture();
  await button("Confirmar restauración").click();
  await expect(button("Confirmar restauración")).toHaveCount(0);
  await expect(
    page.getByText("Copia restaurada", { exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("qgasto:data:v1")),
  );
  assert.deepEqual(stored.state, fixture.data);
  assert.equal(stored.state.recurring.filter((r) => r.installments).length, 3);
  assert.equal(stored.state.recurring.filter((r) => r.archived).length, 2);
  assert.equal(stored.state.events.length, 5);

  await page.reload();
  const reloaded = await page.evaluate(
    () => JSON.parse(localStorage.getItem("qgasto:data:v1")).state,
  );
  assert.deepEqual(reloaded, fixture.data);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: updated JSON preview, cancel safety, full restore and reload persistence.",
  );
} finally {
  await browser.close();
}
