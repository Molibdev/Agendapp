import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply,
  balance,
  contributed,
  dateSchema,
  initialState,
  monthly,
  possibleDuplicate,
  State,
  Transaction,
} from "../src/domain/finance";
import { createWorkbook } from "../src/domain/workbook";
import { writeReportWorkbook } from "../src/domain/reportXlsx";
import * as XLSX from "xlsx";
const fixture = (): State => ({
  ...initialState,
  accounts: [
    {
      id: "bank",
      name: "Banco",
      type: "bank",
      openingBalance: 500000,
      active: true,
    },
    {
      id: "credit",
      name: "Tarjeta",
      type: "credit",
      openingBalance: 0,
      active: true,
    },
  ],
  transactions: [],
  transfers: [],
  budgets: [],
  goals: [],
  contributions: [],
});
const expense: Transaction = {
  id: "purchase",
  type: "expense",
  accountId: "credit",
  categoryId: "food",
  amount: 100000,
  date: "2026-10-31",
  note: "Supermercado",
};
test("compra con tarjeta y pago: un gasto, transferencia sin doble contabilización", () => {
  let s = apply(fixture(), { kind: "transaction", value: expense });
  assert.equal(balance(s, "credit"), -100000);
  s = apply(s, {
    kind: "transfer",
    value: {
      id: "payment",
      fromId: "bank",
      toId: "credit",
      amount: 100000,
      date: "2026-10-31",
    },
  });
  assert.equal(balance(s, "credit"), 0);
  assert.equal(balance(s, "bank"), 400000);
  assert.deepEqual(monthly(s, "2026-10"), { income: 0, expense: 100000 });
  assert.equal(
    s.accounts.reduce((n, a) => n + balance(s, a.id), 0),
    400000,
  );
});
test("transferencias no afectan al resumen e impiden origen igual a destino", () => {
  const s = apply(fixture(), {
    kind: "transfer",
    value: {
      id: "transfer",
      fromId: "bank",
      toId: "credit",
      amount: 20000,
      date: "2026-10-31",
    },
  });
  assert.deepEqual(monthly(s, "2026-10"), { income: 0, expense: 0 });
  assert.throws(() =>
    apply(s, {
      kind: "transfer",
      value: { ...s.transfers[0], id: "bad", toId: "bank" },
    }),
  );
});
test("rechaza montos cero, fraccionarios, categorías incorrectas y cuentas inexistentes", () => {
  for (const amount of [0, -1, 0.5, NaN, Infinity])
    assert.throws(() =>
      apply(fixture(), { kind: "transaction", value: { ...expense, amount } }),
    );
  assert.throws(() =>
    apply(fixture(), {
      kind: "transaction",
      value: { ...expense, categoryId: "salary" },
    }),
  );
  assert.throws(() =>
    apply(fixture(), {
      kind: "transaction",
      value: { ...expense, accountId: "missing" },
    }),
  );
});
test("fechas reales y límites de mes", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  let s = apply(fixture(), { kind: "transaction", value: expense });
  s = apply(s, {
    kind: "transaction",
    value: { ...expense, id: "nov", date: "2026-11-01" },
  });
  assert.equal(monthly(s, "2026-10").expense, 100000);
  assert.equal(monthly(s, "2026-11").expense, 100000);
});
test("reintentos por ID son idempotentes y duplicados se pueden advertir", () => {
  const s = apply(fixture(), { kind: "transaction", value: expense });
  assert.deepEqual(apply(s, { kind: "transaction", value: expense }), s);
  assert.equal(possibleDuplicate(s, { ...expense, id: "new" }), true);
});
test("presupuesto actualiza la combinación mes/categoría", () => {
  let s = apply(fixture(), {
    kind: "budget",
    value: { id: "a", categoryId: "food", month: "2026-10", amount: 10000 },
  });
  s = apply(s, {
    kind: "budget",
    value: { id: "b", categoryId: "food", month: "2026-10", amount: 20000 },
  });
  assert.equal(s.budgets.length, 1);
  assert.equal(s.budgets[0].amount, 20000);
});
test("metas reservan fondos sin gastos y sin sobreasignar cuenta o meta", () => {
  let s = apply(fixture(), {
    kind: "goal",
    value: {
      id: "goal",
      name: "Emergencias",
      target: 600000,
      accountId: "bank",
    },
  });
  s = apply(s, {
    kind: "contribution",
    value: { id: "one", goalId: "goal", amount: 400000, date: "2026-10-31" },
  });
  assert.equal(contributed(s, "goal"), 400000);
  assert.equal(balance(s, "bank"), 500000);
  assert.equal(monthly(s, "2026-10").expense, 0);
  assert.throws(() =>
    apply(s, {
      kind: "contribution",
      value: { id: "two", goalId: "goal", amount: 200000, date: "2026-10-31" },
    }),
  );
  assert.deepEqual(
    apply(s, { kind: "contribution", value: s.contributions[0] }),
    s,
  );
  assert.throws(() =>
    apply(s, {
      kind: "goal",
      value: { id: "bad", name: "Meta", target: 100, accountId: "credit" },
    }),
  );
});
test("XLSX concentra el informe en una hoja, conserva importes y filtra fechas", () => {
  let s = apply(fixture(), {
    kind: "transaction",
    value: { ...expense, note: '=HYPERLINK("https://example.com")' },
  });
  s = apply(s, {
    kind: "transaction",
    value: { ...expense, id: "other", date: "2026-11-01" },
  });
  const wb = createWorkbook(s, "2026-10-01", "2026-10-31");
  assert.deepEqual(wb.SheetNames, ["Agendapp"]);
  assert.equal(wb.report.sections.movements.count, 1);
  const note = wb.Sheets.Agendapp[`L${wb.report.sections.movements.firstRow}`];
  assert.equal(note.t, "s");
  assert.equal(note.f, undefined);
  const restored = XLSX.read(writeReportWorkbook(wb), { type: "array" });
  assert.deepEqual(restored.SheetNames, ["Agendapp"]);
  assert.equal(restored.Sheets.Agendapp.D7.v, 100000);
  assert.equal(
    restored.Sheets.Agendapp[`L${wb.report.sections.movements.firstRow}`].v,
    '=HYPERLINK("https://example.com")',
  );
  assert.throws(() => createWorkbook(s, "2026-11-01", "2026-10-01"));
});

test("recurrentes mensuales conservan el día original, recuperan meses y son idempotentes", () => {
  let s = apply(fixture(), {
    kind: "recurring",
    value: {
      id: "rent",
      type: "expense",
      accountId: "bank",
      categoryId: "home",
      amount: 10000,
      startDate: "2026-01-31",
      nextDate: "2026-01-31",
      active: true,
      note: "Arriendo",
    },
  });
  s = apply(s, { kind: "process-recurring", date: "2026-03-31" });
  assert.deepEqual(
    s.transactions.map((t) => t.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.equal(s.recurring[0].nextDate, "2026-04-30");
  assert.deepEqual(
    apply(s, { kind: "process-recurring", date: "2026-03-31" }),
    s,
  );
  s = apply(s, { kind: "toggle-recurring", id: "rent" });
  assert.equal(
    apply(s, { kind: "process-recurring", date: "2026-10-31" }).transactions
      .length,
    3,
  );
});
