import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, type State } from "../src/domain/finance";
import { spendingSeries } from "../src/domain/insights";
test("el gráfico suma gastos por fecha sin contar ingresos, transferencias ni otros meses", () => {
  const state: State = {
    ...initialState,
    transactions: [
      {
        id: "a",
        type: "expense",
        date: "2028-02-01",
        amount: 1000,
        accountId: "a",
        categoryId: "food",
        note: "",
      },
      {
        id: "b",
        type: "expense",
        date: "2028-02-29",
        amount: 2500,
        accountId: "a",
        categoryId: "food",
        note: "",
      },
      {
        id: "c",
        type: "expense",
        date: "2028-02-01",
        amount: 500,
        accountId: "b",
        categoryId: "home",
        note: "",
      },
      {
        id: "d",
        type: "income",
        date: "2028-02-02",
        amount: 40000,
        accountId: "a",
        categoryId: "salary",
        note: "",
      },
      {
        id: "e",
        type: "expense",
        date: "2028-03-01",
        amount: 1200,
        accountId: "a",
        categoryId: "food",
        note: "",
      },
    ],
    transfers: [
      { id: "f", date: "2028-02-01", fromId: "a", toId: "b", amount: 50000 },
    ],
  };
  const before = structuredClone(state),
    result = spendingSeries(state, "2028-02");
  assert.equal(result.days, 29);
  assert.equal(result.count, 3);
  assert.equal(result.total, 4000);
  assert.deepEqual(result.points[0], {
    day: 1,
    amount: 1500,
    cumulative: 1500,
  });
  assert.equal(result.points[27].cumulative, 1500);
  assert.equal(result.points[28].cumulative, 4000);
  assert.deepEqual(state, before);
});
test("sin gastos se muestra cero y no se generan estimaciones ni fechas fuera de mes", () => {
  const result = spendingSeries(initialState, "2027-02");
  assert.equal(result.days, 28);
  assert.equal(result.total, 0);
  assert.ok(result.points.every((p) => p.cumulative === 0));
  assert.throws(() => spendingSeries(initialState, "2027-13"), /Mes inválido/);
});
