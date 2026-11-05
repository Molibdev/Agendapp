import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate/browser";
import type { DocumentPickerResult } from "expo-document-picker";
import { readBackup } from "../src/domain/backup";
import { pickNativeBackup } from "../src/data/nativeBackup";
import { createExcelFile } from "../src/domain/excel";
import { createWorkbook } from "../src/domain/workbook";

const fixtureText = readFileSync(
  new URL("../examples/agendapp-datos-prueba-v0.12.0.json", import.meta.url),
  "utf8",
);
const state = readBackup(fixtureText);

test("el respaldo 0.12 restaura todas las funciones actuales", async () => {
  const envelope = JSON.parse(fixtureText);
  assert.equal(envelope.format, "qgasto-backup");
  assert.equal(envelope.version, 1);
  assert.equal(state.accounts.length, 4);
  assert.equal(state.transactions.length, 89);
  assert.equal(state.recurring.length, 6);
  assert.equal(state.events.length, 5);
  assert.ok(state.budgets.length >= 7);
  assert.equal(state.goals.length, 2);
  assert.equal(state.contributions.length, 3);
  assert.equal(state.transfers.length, 1);
  assert.ok(state.recurring.some((r) => r.installments && r.active));
  assert.ok(
    state.recurring.some(
      (r) => r.installments?.settledAt && r.archived && !r.active,
    ),
  );
  assert.equal(fixtureText.includes("access_token"), false);
  assert.equal(fixtureText.includes("refresh_token"), false);
  assert.equal(fixtureText.includes("biometric"), false);

  const result: DocumentPickerResult = {
    canceled: false,
    assets: [
      {
        uri: "content://downloads/agendapp-demo",
        name: "agendapp-datos-prueba-v0.12.0.json",
        size: Buffer.byteLength(fixtureText),
        lastModified: 0,
      },
    ],
  };
  const native = await pickNativeBackup(
    "android",
    async (options) => {
      assert.equal(options.copyToCacheDirectory, false);
      return result;
    },
    async (uri) => {
      assert.equal(uri, "content://downloads/agendapp-demo");
      return fixtureText;
    },
  );
  assert.deepEqual(native, state);
});

test("el informe distingue intervalo, mes, año y corte sin duplicar cuotas", () => {
  const wb = createWorkbook(state, "2026-11-01", "2026-11-05");
  assert.deepEqual(wb.SheetNames, ["Agendapp"]);
  assert.equal(wb.report.stats.income, 1_780_000);
  assert.equal(wb.report.stats.expense, 923_250);
  assert.equal(wb.report.stats.net, 856_750);
  assert.equal(wb.report.stats.monthExpense, 923_250);
  assert.equal(wb.report.stats.yearExpense, 10_331_850);
  assert.equal(wb.report.stats.yearIncome, 18_055_000);
  assert.equal(wb.report.sections.movements.count, 8);
  assert.equal(wb.report.sections.transfers.count, 1);
  assert.equal(wb.report.sections.agenda.count, 0);
  assert.equal(wb.report.sections.plans.count, 6);
  assert.equal(wb.report.sections.financing.count, 3);
  assert.equal(wb.report.charts.length, 2);
  assert.equal(
    wb.report.charts[1].series[0].values.reduce((n, v) => n + v, 0),
    wb.report.stats.expense,
  );
  assert.equal(
    wb.report.charts[0].series[1].values.at(-1),
    wb.report.stats.monthExpense,
  );
  const values = Object.values(wb.Sheets.Agendapp).map((c) =>
    typeof c === "object" && "v" in c ? c.v : undefined,
  );
  assert.equal(
    values.includes("Compra futura: fuera del corte noviembre · DEMO"),
    false,
  );
  assert.equal(values.includes("Ingreso del año anterior · DEMO"), false);
});

test("el XLSX final contiene gráficos, tablas, impresión y estilos nativos", () => {
  const file = createExcelFile(state, "2026-11-01", "2026-11-30");
  const parsed = XLSX.read(file.bytes, { type: "array" });
  assert.deepEqual(parsed.SheetNames, ["Agendapp"]);
  assert.equal(parsed.Sheets.Agendapp.A7.t, "n");
  assert.equal(parsed.Sheets.Agendapp.D7.t, "n");
  const zip = unzipSync(file.bytes);
  const paths = Object.keys(zip);
  assert.equal(
    paths.filter((p) => /^xl\/charts\/chart\d+\.xml$/.test(p)).length,
    2,
  );
  assert.equal(
    paths.filter((p) => /^xl\/tables\/table\d+\.xml$/.test(p)).length,
    11,
  );
  assert.equal(
    paths.some((p) => /externalLinks|vbaProject/i.test(p)),
    false,
  );
  const sheet = strFromU8(zip["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /fitToWidth="1"/);
  assert.match(sheet, /<tableParts count="11">/);
  assert.ok(sheet.indexOf("<pageSetup") < sheet.indexOf("<drawing"));
  assert.ok(sheet.indexOf("<drawing") < sheet.indexOf("<tableParts"));
  const styles = strFromU8(zip["xl/styles.xml"]);
  assert.match(styles, /AgendappViolet/);
  assert.match(styles, /FF7842D6/);
  const workbook = strFromU8(zip["xl/workbook.xml"]);
  assert.match(workbook, /_xlnm\.Print_Area/);
  assert.match(workbook, /_xlnm\.Print_Titles/);
  for (const chart of ["xl/charts/chart1.xml", "xl/charts/chart2.xml"]) {
    const xml = strFromU8(zip[chart]);
    assert.match(xml, /&apos;Agendapp&apos;!\$/);
  }
});
