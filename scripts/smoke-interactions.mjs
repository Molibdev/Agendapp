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
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const tab = (name) => page.getByRole("tab", { name, exact: true });
const panel = () => page.getByTestId("sheet-panel");
async function drag(distance, touch = false) {
  await button("Cerrar menú emergente").click({ trial: true });
  const b = await button("Cerrar menú emergente").boundingBox();
  if (touch) {
    const client = await page.context().newCDPSession(page);
    const x = b.x + b.width / 2,
      y = b.y + 12;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 12; i++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + (distance * i) / 12 }],
      });
      await page.waitForTimeout(16);
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await client.detach();
  } else {
    await page.mouse.move(b.x + b.width / 2, b.y + 12);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + 12 + distance, {
      steps: 12,
    });
    await page.mouse.up();
  }
}
try {
  const fixture = JSON.parse(
    readFileSync("examples/qgasto-datos-prueba.json"),
  ).data;
  fixture.recurring = [];
  await page.addInitScript((f) => {
    localStorage.setItem("qgasto:theme", "dark");
    localStorage.setItem(
      "qgasto:data:v1",
      JSON.stringify({ state: f, dirty: false, revision: 0 }),
    );
  }, fixture);
  await page.goto("http://127.0.0.1:8081");
  await expect(page.getByTestId("launch-screen")).toHaveCount(0);
  const dock = page.getByTestId("bottom-navigation");
  await expect(dock).toHaveCSS("position", "absolute");
  const original = await button("Registrar gasto").boundingBox();
  await page.mouse.move(original.x + 20, original.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(130);
  const pressed = await button("Registrar gasto").boundingBox();
  assert.ok(
    pressed.width < original.width - 0.5,
    "button visibly responds while held",
  );
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await expect(panel()).toHaveCount(0);
  await tab("Cuentas").click();
  await button("Editar datos de Corriente principal · DEMO").click();
  await expect(page.getByText("Editar cuenta", { exact: true })).toBeVisible();
  await expect(page.getByText("Nueva cuenta", { exact: true })).toHaveCount(0);
  const safe = await panel().evaluate((e) =>
    parseFloat(getComputedStyle(e).paddingBottom),
  );
  assert.ok(safe >= 16);
  await drag(25);
  await expect(panel()).toBeVisible();
  await drag(155);
  await expect(panel()).toHaveCount(0);
  await tab("Inicio").click();
  await button("Mes consultado").click();
  await expect(button("Cerrar calendario")).toBeVisible();
  await drag(155, true);
  await expect(panel()).toHaveCount(0);
  await tab("Agenda").click();
  await button("+ Evento").click();
  await page
    .getByLabel("Título del evento", { exact: true })
    .fill("Borrador conservado");
  const time = page.getByLabel("Hora de inicio", { exact: true });
  await expect(time).toHaveAttribute("type", "time");
  await time.fill("14:37");
  await button("Fecha de inicio").click();
  await expect(time).toHaveCount(0);
  await drag(155);
  await expect(
    page.getByLabel("Título del evento", { exact: true }),
  ).toHaveValue("Borrador conservado");
  await expect(page.getByLabel("Hora de inicio", { exact: true })).toHaveValue(
    "14:37",
  );
  await page.setViewportSize({ width: 390, height: 420 });
  await button("Cancelar evento").scrollIntoViewIfNeeded();
  const b = await button("Cancelar evento").boundingBox();
  assert.ok(b.y + b.height < 420 - 10);
  await page.screenshot({ path: "/tmp/agendapp-short-sheet.png" });
  await button("Cancelar evento").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await tab("Inicio").click();
  await expect(tab("Inicio")).toHaveAttribute("aria-selected", "true");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: subtle press animation, floating dock, edit title, safe sheet footer, drag threshold, calendar dismissal preserves draft, separate time control and short viewport.",
  );
} catch (error) {
  await page.screenshot({ path: "/tmp/agendapp-interaction-error.png" });
  throw error;
} finally {
  await browser.close();
}
