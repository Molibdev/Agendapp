import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { initialState, apply } from "../src/domain/finance";
import { createExcelFile, EXCEL_MIME_TYPE } from "../src/domain/excel";
import { uploadExcelDrive, driveRequest, listDrive } from "../src/data/drive";
let state = apply(initialState, {
  kind: "account",
  value: {
    id: "a",
    name: "Banco",
    type: "bank",
    openingBalance: 100000,
    active: true,
  },
});
state = apply(state, {
  kind: "transaction",
  value: {
    id: "t",
    type: "expense",
    accountId: "a",
    categoryId: "food",
    amount: 5000,
    date: "2026-11-02",
    note: "Almuerzo",
  },
});
state = apply(state, {
  kind: "transaction",
  value: {
    id: "old",
    type: "expense",
    accountId: "a",
    categoryId: "food",
    amount: 12000,
    date: "2026-10-02",
    note: "Mes anterior",
  },
});
test("Excel compartido conserva las nueve hojas y filtra los movimientos por fecha", () => {
  const file = createExcelFile(state, "2026-11-01", "2026-11-30");
  assert.equal(file.name, "Agendapp_2026-11-01_2026-11-30.xlsx");
  const workbook = XLSX.read(file.bytes, { type: "array" });
  assert.equal(workbook.SheetNames.length, 9);
  assert.equal(workbook.Sheets.Resumen.E2.v, 5000);
  assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets.Movimientos).length, 1);
});
test("Drive recibe un XLSX binario íntegro con metadatos y responde con confirmación", async () => {
  const file = createExcelFile(state, "2026-11-01", "2026-11-30");
  let calls = 0;
  const request: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    );
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-token",
    );
    const contentType = (init?.headers as Record<string, string>)[
      "Content-Type"
    ];
    const boundary = contentType.split("boundary=")[1];
    const bytes = Buffer.from(init!.body as ArrayBuffer);
    const divider = Buffer.from(`\r\n--${boundary}\r\n`);
    const firstEnd = bytes.indexOf(divider);
    const metadata = JSON.parse(
      bytes.subarray(bytes.indexOf("\r\n\r\n") + 4, firstEnd).toString(),
    );
    assert.equal(metadata.name, file.name);
    assert.equal(metadata.mimeType, EXCEL_MIME_TYPE);
    assert.equal(metadata.appProperties.format, "excel-v1");
    const start = bytes.indexOf("\r\n\r\n", firstEnd + divider.length) + 4;
    const end = bytes.lastIndexOf(Buffer.from(`\r\n--${boundary}--`));
    const uploaded = bytes.subarray(start, end);
    assert.equal(
      XLSX.read(uploaded, { type: "buffer" }).Sheets.Resumen.E2.v,
      5000,
    );
    assert.deepEqual(uploaded.subarray(0, 2), Buffer.from("PK"));
    return new Response(JSON.stringify({ id: "file-123", name: file.name }), {
      status: 200,
    });
  };
  assert.deepEqual(
    await uploadExcelDrive(
      "test-token",
      state,
      "2026-11-01",
      "2026-11-30",
      request,
    ),
    { id: "file-123", name: file.name },
  );
  assert.equal(calls, 1);
});
test("intervalo inválido o conexión ausente impiden enviar archivos", async () => {
  const request: typeof fetch = async () => assert.fail("No debe enviar");
  await assert.rejects(
    uploadExcelDrive("token", state, "2026-12-01", "2026-11-01", request),
    /fecha inicial/,
  );
  await assert.rejects(
    uploadExcelDrive("", state, "2026-11-01", "2026-11-30", request),
    /Conecta Google/,
  );
});
test("errores de Drive distinguen autorización, API desactivada, permisos y cuota sin reintentos", async () => {
  for (const [status, body, message] of [
    [401, {}, /venció/],
    [
      403,
      { error: { errors: [{ reason: "accessNotConfigured" }] } },
      /no está habilitada/,
    ],
    [
      403,
      { error: { errors: [{ reason: "insufficientPermissions" }] } },
      /no autorizó/,
    ],
    [429, {}, /demasiadas solicitudes/],
    [500, {}, /500/],
  ] as const) {
    let calls = 0;
    await assert.rejects(
      driveRequest("token", "https://www.googleapis.com/test", {}, async () => {
        calls++;
        return new Response(JSON.stringify(body), { status });
      }),
      message,
    );
    assert.equal(calls, 1);
  }
});
test("Drive exige una confirmación de archivo y no mezcla Excel con copias restaurables", async () => {
  await assert.rejects(
    uploadExcelDrive(
      "token",
      state,
      "2026-11-01",
      "2026-11-30",
      async () => new Response("{}", { status: 200 }),
    ),
    /no confirmó/,
  );
  const files = await listDrive("token", async (url) => {
    const q = new URL(String(url)).searchParams.get("q")!;
    assert.ok(q.includes("mimeType = 'application/json'"));
    assert.ok(q.includes("value='qgasto'"));
    return new Response(
      JSON.stringify({ files: [{ id: "backup", name: "Agendapp.json" }] }),
      { status: 200 },
    );
  });
  assert.equal(files[0].id, "backup");
});
