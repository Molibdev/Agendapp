import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  timezoneId: "America/Santiago",
  acceptDownloads: true,
});
page.setDefaultTimeout(10000);
await page.clock.install({ time: new Date("2026-11-02T15:00:00Z") });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const field = (name) =>
  name.startsWith("Hora de")
    ? page.getByLabel(name, { exact: true })
    : page.getByRole("textbox", { name, exact: true });
const edit = (title) => button(`Editar evento: ${title}`);
const date = async (label, day) => {
  await button(label).click();
  await field("Año del calendario").fill(day.slice(0, 4));
  await button(day).click();
};
try {
  await page.goto(process.env.QGASTO_URL || "http://127.0.0.1:8081");
  await expect(button("Abrir ajustes")).toBeVisible();
  assert.equal(
    await page.getByText("En tu dispositivo", { exact: false }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("tab", { name: "Ajustes", exact: true }).count(),
    0,
  );
  await button("Abrir ajustes").click();
  await expect(button("Cerrar ajustes")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByText("A tu manera", { exact: true })).toBeVisible();
  await button("Cerrar ajustes").click();
  await expect(page.getByText("TU RESUMEN", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Agenda", exact: true }).click();
  await expect(button("Ir a fecha")).toContainText("02 / 11 / 2026");
  await button("Crear evento").click();
  await button("Guardar evento").click();
  await expect(
    page.getByText("Escribe un título para el evento.", { exact: true }),
  ).toBeVisible();
  await field("Título del evento").fill("Planificación");
  await field("Hora de fin").fill("08:00");
  await button("Guardar evento").click();
  await expect(
    page.getByText("El fin debe ser posterior al inicio.", { exact: true }),
  ).toBeVisible();
  await field("Hora de fin").fill("10:00");
  await field("Locación").fill("Oficina Santiago");
  await field("Descripción").fill("Revisar el presupuesto del mes");
  await page.getByRole("switch", { name: "Un día antes", exact: true }).check();
  await page.getByRole("switch", { name: "El mismo día", exact: true }).check();
  await expect(
    page.getByText(/En Android, avisa a la hora del evento/),
  ).toBeVisible();
  await button("Guardar evento").click();
  await expect(edit("Planificación")).toBeVisible();
  await expect(
    page.getByText(/^Las preferencias se guardarán.* i$/),
  ).toBeVisible();
  await button("Cerrar notificación").click();
  await expect(
    page.getByText("Evento creado ✓", { exact: true }),
  ).toBeVisible();
  await edit("Planificación").click();
  await expect(button("Cerrar notificación")).toHaveCount(1);
  await expect(
    page.getByText("Evento creado ✓", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/agendapp-feedback-editor.png" });
  await button("Cerrar notificación").click();
  await button("Cancelar evento").click();
  await page.reload();
  await page.getByRole("tab", { name: "Agenda", exact: true }).click();
  await edit("Planificación").click();
  await expect(field("Locación")).toHaveValue("Oficina Santiago");
  await expect(field("Descripción")).toHaveValue(
    "Revisar el presupuesto del mes",
  );
  await expect(
    page.getByRole("switch", { name: "Un día antes", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "El mismo día", exact: true }),
  ).toBeChecked();
  await field("Título del evento").fill("Planificación futura");
  await date("Fecha de inicio", "2027-11-05");
  await date("Fecha de fin", "2027-11-05");
  await button("Guardar evento").click();
  await expect(edit("Planificación futura")).toBeVisible();
  await button("Período anterior").click();
  await expect(edit("Planificación futura")).toHaveCount(0);
  await button("Período siguiente").click();
  await expect(edit("Planificación futura")).toBeVisible();
  await button("Vista semana").click();
  await expect(edit("Planificación futura")).toHaveCount(1);
  await edit("Planificación futura").click();
  await expect(field("Hora de inicio")).toHaveValue("09:00");
  await button("Cancelar evento").click();
  await button("Vista día").click();
  await expect(edit("Planificación futura")).toHaveCount(1);
  await edit("Planificación futura").click();
  await field("Título del evento").fill("Cambio descartado");
  await button("Cancelar evento").click();
  await expect(edit("Planificación futura")).toHaveCount(1);
  await button("Vista mes").click();
  await button("Crear evento").click();
  await field("Título del evento").fill("Turno nocturno");
  await field("Hora de inicio").fill("23:00");
  await date("Fecha de fin", "2027-11-06");
  await field("Hora de fin").fill("01:00");
  await button("Guardar evento").click();
  await expect(edit("Turno nocturno")).toBeVisible();
  await button("Ver 2027-11-06, 1 eventos").click();
  await expect(edit("Turno nocturno")).toBeVisible();
  await expect(edit("Planificación futura")).toHaveCount(0);
  await button("Vista día").click();
  await expect(page.getByText("00:00 – 01:00", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/qgasto-agenda-day.png" });
  await button("Vista semana").click();
  await expect(edit("Turno nocturno")).toHaveCount(2);
  await page.screenshot({ path: "/tmp/qgasto-agenda-week.png" });
  await button("Ver día 2027-11-06").click();
  await expect(button("Vista día")).toHaveAttribute("aria-selected", "true");
  await button("Vista semana").click();
  await button("Período siguiente").click();
  await expect(edit("Turno nocturno")).toHaveCount(0);
  await button("Hoy").click();
  await expect(button("Ir a fecha")).toContainText("02 / 11 / 2026");
  // Backups retain event data and preferences without activating notifications.
  await button("Abrir ajustes").click();
  const downloadPromise = page.waitForEvent("download");
  await button("Descargar copia JSON").click();
  const download = await downloadPromise;
  const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
  assert.equal(backup.data.events.length, 2);
  assert.equal(
    backup.data.events.find((e) => e.title === "Planificación futura")
      .remindSameDay,
    true,
  );
  await button("Cerrar ajustes").click();
  await page.getByRole("tab", { name: "Agenda", exact: true }).click();
  await button("Ir a fecha").click();
  await field("Año del calendario").fill("2027");
  await button("2027-11-05").click();
  await edit("Planificación futura").click();
  await button("Eliminar evento").click();
  await button("Conservar evento").click();
  await button("Cancelar evento").click();
  await expect(edit("Planificación futura")).toBeVisible();
  await edit("Planificación futura").click();
  await button("Eliminar evento").click();
  await button("Confirmar eliminación").click();
  await expect(edit("Planificación futura")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Agenda", exact: true }).click();
  await button("Ir a fecha").click();
  await field("Año del calendario").fill("2027");
  await button("2027-11-05").click();
  await expect(edit("Planificación futura")).toHaveCount(0);
  await expect(edit("Turno nocturno")).toBeVisible();
  await page.screenshot({ path: "/tmp/qgasto-agenda-month.png" });
  await page.setViewportSize({ width: 320, height: 640 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await button("Abrir ajustes").click();
  await button("Cambiar a modo nocturno").click();
  await button("Cerrar ajustes").click();
  await page.getByRole("tab", { name: "Agenda", exact: true }).click();
  await page.screenshot({ path: "/tmp/qgasto-agenda-dark.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await button("Ir a fecha").click();
  await field("Año del calendario").fill("2027");
  await button("2027-11-05").click();
  await page.screenshot({ path: "/tmp/qgasto-agenda-desktop.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  // Restore the downloaded snapshot after deletion, retaining event metadata.
  await button("Abrir ajustes").click();
  const chooser = page.waitForEvent("filechooser");
  await button("Cargar copia de seguridad").click();
  await (
    await chooser
  ).setFiles({
    name: "agenda.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await button("Confirmar restauración").click();
  await expect(
    page.getByText("Copia restaurada", { exact: true }),
  ).toBeVisible();
  await button("Cerrar ajustes").click();
  await page.getByRole("tab", { name: "Agenda", exact: true }).click();
  await button("Ir a fecha").click();
  await field("Año del calendario").fill("2027");
  await button("2027-11-05").click();
  await expect(edit("Planificación futura").first()).toBeVisible();
  // Also exercise the animated header with the OS motion preference enabled.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (let i = 0; i < 2; i++) {
    await button("Abrir ajustes").click();
    await expect(button("Cerrar ajustes")).toBeVisible();
    await button("Cerrar ajustes").click();
    await expect(button("Abrir ajustes")).toBeVisible();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Agenda mes/semana/día, CRUD y cancelación, eventos nocturnos, persistencia, respaldo de recordatorios, hora local, navegación futura/pasada, diseños móvil/escritorio y acceso animado a Ajustes; sin errores JS.",
  );
} catch (error) {
  await page.screenshot({ path: "/tmp/qgasto-agenda-error.png" });
  throw error;
} finally {
  await browser.close();
}
