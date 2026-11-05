import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply,
  initialState,
  monthly,
  processRecurring,
  type State,
} from "../src/domain/finance";
import { makeBackup, readBackup } from "../src/domain/backup";
function fixture(installments = false): State {
  return apply(
    {
      ...initialState,
      accounts: [
        {
          id: "bank",
          name: "Banco",
          type: "bank",
          openingBalance: 500000,
          active: true,
        },
      ],
    },
    {
      kind: "recurring",
      value: {
        id: "bill",
        accountId: "bank",
        categoryId: "home",
        type: installments ? "installment" : "expense",
        amount: 30000,
        note: "Servicio",
        active: true,
        startDate: "2026-01-01",
        nextDate: "2026-01-01",
        ...(installments
          ? {
              installments: {
                principal: 30000,
                interest: 0,
                count: 3,
                paid: 0,
                paidAmount: 0,
              },
            }
          : {}),
      },
    },
  );
}
test("removing an ordinary recurring payment stops future charges and preserves history", () => {
  let s = processRecurring(fixture(), "2026-01-01"),
    history = s.transactions;
  s = apply(s, { kind: "delete-recurring", id: "bill" });
  assert.equal(s.recurring[0].archived, true);
  assert.equal(s.recurring[0].active, false);
  assert.deepEqual(s.transactions, history);
  assert.deepEqual(processRecurring(s, "2028-01-01"), s);
  assert.deepEqual(apply(s, { kind: "toggle-recurring", id: "bill" }), s);
  assert.deepEqual(apply(s, { kind: "delete-recurring", id: "bill" }), s);
  assert.deepEqual(readBackup(makeBackup(s)), s);
  assert.equal(monthly(s, "2026-01").expense, 30000);
});
test("unpaid installment plans cannot be removed, even while paused", () => {
  const s = processRecurring(fixture(true), "2026-01-01");
  assert.throws(
    () => apply(s, { kind: "delete-recurring", id: "bill" }),
    /totalmente pagada/,
  );
  assert.throws(() =>
    makeBackup({
      ...s,
      recurring: [{ ...s.recurring[0], active: false, archived: true }],
    }),
  );
  const paused = apply(s, { kind: "toggle-recurring", id: "bill" });
  assert.throws(() => apply(paused, { kind: "delete-recurring", id: "bill" }));
});
test("a completed installment plan can be hidden without breaking financial backup validation", () => {
  let s = processRecurring(fixture(true), "2026-03-01"),
    history = s.transactions;
  s = apply(s, { kind: "delete-recurring", id: "bill" });
  assert.equal(s.recurring[0].archived, true);
  assert.deepEqual(s.transactions, history);
  assert.deepEqual(readBackup(makeBackup(s)), s);
  assert.throws(() =>
    apply(s, {
      kind: "recurring",
      value: { ...s.recurring[0], active: true, archived: false },
    }),
  );
});
test("an early-paid plan can be removed and its settlement remains intact", () => {
  let s = apply(fixture(true), {
    kind: "settle-installments",
    id: "bill",
    date: "2026-01-15",
  });
  s = apply(s, { kind: "delete-recurring", id: "bill" });
  assert.equal(
    s.transactions.reduce((n, t) => n + t.amount, 0),
    30000,
  );
  assert.equal(s.recurring[0].installments?.settledAt, "2026-01-15");
  assert.deepEqual(readBackup(makeBackup(s)), s);
});
