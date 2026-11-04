// Render approved vectors deterministically. Requires Inkscape only when regenerating assets.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const folder = resolve("assets/brand");
mkdirSync(folder, { recursive: true });
const source = readFileSync(resolve(folder, "source/logo-icon.svg"), "utf8");
const paths = source.match(/<path\b[^>]*\/>/g);
if (paths?.length !== 3)
  throw new Error("Expected the approved calendar/A/check mark.");
const white = paths
  .map((p) => p.replaceAll('stroke="#000"', 'stroke="#F5F2FC"'))
  .join("\n");
const rectangle =
  '<rect x="24" y="24" width="208" height="208" rx="50" fill="#7842D6"/>';
const mark = rectangle + "\n" + white;
// Keep every stroke inside Android's central 66 dp safe zone, including round masks.
const adaptive = `<g transform="translate(128 128) scale(.84) translate(-128 -119.5)">${white}</g>`;
const svg = (title, body, viewBox = "0 0 256 256") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img"><title>${title}</title>${body}</svg>\n`;
const entries = [
  [
    "assets/agendapp-mark.svg",
    svg("Agendapp — Agenda y finanzas", mark),
    "assets/agendapp-mark.png",
    1024,
    1024,
  ],
  [
    "assets/brand/app-icon.svg",
    svg(
      "Agendapp — Icono de aplicación",
      '<rect width="256" height="256" fill="#7842D6"/>' + white,
    ),
    "assets/icon.png",
    1024,
    1024,
  ],
  [
    "assets/brand/adaptive-foreground.svg",
    svg("Agendapp — Símbolo adaptable", adaptive),
    "assets/android-icon-foreground.png",
    1080,
    1080,
  ],
  [
    "assets/brand/adaptive-background.svg",
    svg(
      "Agendapp — Fondo violeta",
      '<rect width="256" height="256" fill="#7842D6"/>',
    ),
    "assets/android-icon-background.png",
    1080,
    1080,
  ],
];
for (const mode of ["light", "dark"]) {
  const original = readFileSync(
    resolve(
      folder,
      mode === "dark" ? "source/logo-dark.svg" : "source/logo.svg",
    ),
    "utf8",
  );
  const text = original.match(/<text\b[\s\S]*?<\/text>/)?.[0];
  if (!text) throw new Error("Approved wordmark missing");
  entries.push([
    `assets/brand/logo-${mode}.svg`,
    svg(
      `Agendapp — Firma ${mode === "dark" ? "clara" : "oscura"}`,
      mark + text,
      "0 0 1024 256",
    ),
    `assets/brand/logo-${mode}.png`,
    1600,
    400,
  ]);
  if (mode === "dark")
    entries.push([
      "assets/brand/wordmark-dark.svg",
      svg("Agendapp — Nombre de marca", text, "260 0 764 256"),
      "assets/brand/wordmark-dark.png",
      1200,
      402,
    ]);
}
// Same sources for native splash, favicon, Android themed icon and notification icon.
entries.push([
  "assets/agendapp-mark.svg",
  svg("Agendapp — Agenda y finanzas", mark),
  "assets/splash-icon.png",
  1024,
  1024,
]);
entries.push([
  "assets/brand/app-icon.svg",
  svg(
    "Agendapp — Icono de aplicación",
    '<rect width="256" height="256" fill="#7842D6"/>' + white,
  ),
  "assets/favicon.png",
  64,
  64,
]);
entries.push([
  "assets/brand/adaptive-foreground.svg",
  svg("Agendapp — Símbolo adaptable", adaptive),
  "assets/android-icon-monochrome.png",
  1080,
  1080,
]);
entries.push([
  "assets/brand/notification-icon.svg",
  svg("Agendapp — Recordatorios", white),
  "assets/notification-icon.png",
  96,
  96,
]);
for (const [file, content, output, width, height] of entries) {
  writeFileSync(resolve(file), content);
  const result = spawnSync(
    "inkscape",
    [
      resolve(file),
      "--export-type=png",
      `--export-width=${width}`,
      `--export-height=${height}`,
      "--export-background-opacity=0",
      `--export-filename=${resolve(output)}`,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || "Inkscape could not render " + output);
  console.log(`${output}: ${width} × ${height}`);
}
