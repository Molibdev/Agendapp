// Visual and behavioral checks against the local export; no remote services.
import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
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
const tab = (name) => page.getByRole("tab", { name, exact: true });
try {
  await page.clock.install({ time: new Date("2026-11-03T15:00:00Z") });
  const fixture = JSON.parse(
    readFileSync("examples/qgasto-datos-prueba.json", "utf8"),
  ).data;
  fixture.events = [
    {
      id: "design-event",
      title: "Revisar mis planes",
      startsAt: "2026-11-03T15:00",
      endsAt: "2026-11-03T16:00",
      location: "Casa",
      description: "",
      remindDayBefore: false,
      remindSameDay: false,
    },
  ];
  await page.addInitScript((fixture) => {
    localStorage.setItem("qgasto:theme", "dark");
    localStorage.setItem(
      "qgasto:data:v1",
      JSON.stringify({ state: fixture, dirty: false, revision: 0 }),
    );
  }, fixture);
  await page.goto(process.env.QGASTO_URL || "http://127.0.0.1:8081");
  await expect(
    page.getByText("Ritmo de gastos", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "/tmp/agendapp-redesign-home-dark.png" });
  await button("Explorar gastos acumulados").click();
  await expect(page.getByText(/Día \d+ · .* acumulados/)).toBeVisible();
  const chart = button("Explorar gastos acumulados"),
    box = await chart.boundingBox();
  await chart.click({ position: { x: box.width - 2, y: 40 } });
  await button("Mes consultado").click();
  await page
    .getByRole("textbox", { name: "Año del calendario", exact: true })
    .fill("2027");
  await button("Febrero 2027").click();
  await expect(page.getByText("Feb 2027", { exact: true })).toBeVisible();
  await button("Explorar gastos acumulados").click();
  await button("Mes consultado").click();
  await button("Hoy").click();
  await tab("Actividad").click();
  const search = page.getByRole("textbox", {
    name: "Buscar movimientos",
    exact: true,
  });
  await search.fill("not-a-real-transaction-abcdef");
  await expect(
    page.getByText("No hay movimientos que coincidan con estos filtros.", {
      exact: true,
    }),
  ).toBeVisible();
  await search.fill("Sueldo");
  await expect(
    page.getByRole("button", { name: /^Editar gasto:/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Editar ingreso:/ }),
  ).not.toHaveCount(0);
  await button("Limpiar búsqueda").click();
  await expect(search).toHaveValue("");
  await button("Filtrar gastos").click();
  await expect(
    page.getByRole("button", { name: /^Editar ingreso:/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Editar gasto:/ }),
  ).not.toHaveCount(0);
  await button("Filtrar todos").click();
  await expect(
    page.getByRole("button", { name: /^Editar ingreso:/ }),
  ).not.toHaveCount(0);
  await page.screenshot({ path: "/tmp/agendapp-redesign-activity-dark.png" });
  await tab("Cuentas").click();
  await page.screenshot({ path: "/tmp/agendapp-redesign-accounts-dark.png" });
  await button("Abrir ajustes").click();
  await expect(page.getByText("Google Drive", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Cuenta y sincronización", { exact: true }),
  ).toHaveCount(0);
  const normalPadding = await page
    .getByText("Copias de seguridad", { exact: true })
    .evaluate((el) =>
      parseFloat(getComputedStyle(el.parentElement).paddingTop),
    );
  await button("Abrir perfil").click();
  await expect(page.getByText("Google Drive", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nombre de categoría", exact: true }),
  ).toHaveCount(0);
  const profilePadding = await page
    .getByText("Google Drive", { exact: true })
    .evaluate((el) =>
      parseFloat(getComputedStyle(el.parentElement.parentElement).paddingTop),
    );
  assert.ok(
    profilePadding <= normalPadding * 0.75,
    "profile panels use at least 25% less padding",
  );
  for (const name of ["Cerrar perfil", "Abrir ajustes"]) {
    const box = await button(name).boundingBox();
    assert.ok(
      box.width >= 44 && box.height >= 44,
      "compact header retains 44px touch targets",
    );
  }
  await page.screenshot({ path: "/tmp/agendapp-redesign-profile-dark.png" });
  await button("Cerrar perfil").click();
  await expect(tab("Inicio")).toHaveAttribute("aria-selected", "true");
  await button("Abrir ajustes").click();
  await button("Cambiar a modo claro").click();
  await tab("Inicio").click();
  await page.screenshot({ path: "/tmp/agendapp-redesign-home-light.png" });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["Inicio", "Actividad", "Cuentas", "Planes", "Agenda"]) {
      await tab(name).click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${name}: no horizontal page overflow at ${width}px`,
      );
    }
    await button("Abrir perfil").click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `profile: no horizontal overflow at ${width}px`,
    );
    await button("Cerrar perfil").click();
  }
  await tab("Inicio").click();
  await page.screenshot({ path: "/tmp/agendapp-redesign-desktop-light.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: redesigned screens at 320/390/768/1280px, themes, expense exploration, search/filter, separate profile, compact panels and accessible header targets.",
  );
} finally {
  await browser.close();
}
