import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [],
  timings = [];
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const fixture = JSON.parse(
      readFileSync("examples/agendapp-datos-prueba-v0.12.0.json", "utf8"),
    ).data;
    await page.addInitScript((state) => {
      localStorage.setItem(
        "qgasto:data:v1",
        JSON.stringify({ state, revision: 0, dirty: false }),
      );
    }, fixture);
    await page.goto(process.env.QGASTO_URL || "http://127.0.0.1:8081");
    await expect(page.getByTestId("launch-screen")).toHaveCount(0);
    await expect(page.getByText("Tu dinero", { exact: true })).toBeVisible();
    async function navigate(role, label, marker, area = "section-content") {
      const result = await page
        .getByRole(role, { name: label, exact: true })
        .evaluate(
          (button, { marker, area }) =>
            new Promise((resolve) => {
              const started = performance.now();
              let first = null,
                minimum = 1;
              button.click();
              const frame = () => {
                const content = document.querySelector(
                  `[data-testid="${area}"]`,
                );
                const opacity = content
                  ? Number(getComputedStyle(content).opacity)
                  : 0;
                minimum = Math.min(minimum, opacity);
                const arrived =
                  content?.textContent.includes(marker) ||
                  (marker === "Agenda" &&
                    !!content?.querySelector(
                      '[aria-label="Vista de la agenda"]',
                    ));
                if (arrived && first === null)
                  first = performance.now() - started;
                if (
                  arrived &&
                  opacity >= 0.999 &&
                  new DOMMatrix(getComputedStyle(content).transform).m42 === 0
                ) {
                  resolve({
                    first,
                    settled: performance.now() - started,
                    minimum,
                  });
                } else if (performance.now() - started > 1000) {
                  resolve({ first, settled: Infinity, minimum });
                } else requestAnimationFrame(frame);
              };
              requestAnimationFrame(frame);
            }),
          { marker, area },
        );
      assert.ok(
        result.first !== null && result.first < 250,
        `${label}: destination appears immediately (${result.first} ms)`,
      );
      assert.ok(
        result.settled < 400,
        `${label}: entry finishes promptly (${result.settled} ms)`,
      );
      assert.ok(
        result.minimum >= 0.9,
        `${label}: navigation never blanks the page`,
      );
      if (reducedMotion === "reduce") assert.equal(result.minimum, 1);
      timings.push({
        mode: reducedMotion,
        label,
        first: Math.round(result.first),
        settled: Math.round(result.settled),
      });
    }
    for (const [label, marker] of [
      ["Cuentas", "Saldos y cupos"],
      ["Actividad", "Movimientos"],
      ["Planes", "Lo que viene"],
      ["Agenda", "Agenda"],
      ["Inicio", "Tu dinero"],
    ])
      await navigate("tab", label, marker);
    await navigate("button", "Abrir ajustes", "Elige qué quieres ajustar");
    for (const label of [
      "Apariencia",
      "Seguridad",
      "Categorías de gasto",
      "Copias de seguridad",
      "Créditos y licencias",
    ]) {
      await navigate("button", label, label, "settings-page");
      await navigate(
        "button",
        "Volver a Ajustes",
        "Elige qué quieres ajustar",
        "settings-page",
      );
    }
    await navigate("button", "Cerrar ajustes", "Tu dinero");
    await navigate("button", "Abrir perfil", "Cuenta y sincronización");
    await navigate("button", "Abrir ajustes", "Elige qué quieres ajustar");
    await navigate("button", "Abrir perfil", "Cuenta y sincronización");
    await navigate("button", "Cerrar perfil", "Tu dinero");
    // Multiple requests in one frame, including a return to the original screen.
    await page.evaluate(() => {
      for (const name of ["Cuentas", "Actividad", "Inicio"])
        document.querySelector(`[role="tab"][aria-label="${name}"]`).click();
    });
    await expect(
      page.getByRole("tab", { name: "Inicio", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Tu dinero", { exact: true })).toBeVisible();
    await expect(page.getByTestId("section-content")).toHaveCSS("opacity", "1");
    await navigate("tab", "Cuentas", "Saldos y cupos");
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      transitions: timings.length,
      maxFirstFrameMs: Math.max(...timings.map((t) => t.first)),
      maxSettledMs: Math.max(...timings.map((t) => t.settled)),
    }),
  );
  console.log(
    "PASS: immediate section changes, no blank frames, brief entry, settings submenus, rapid taps and reduced motion.",
  );
} finally {
  await browser.close();
}
