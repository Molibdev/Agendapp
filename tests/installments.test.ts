import { z } from "zod";
import { transactionSchema, dateSchema } from "../src/domain/finance";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply,
  initialState,
  processRecurring,
  monthly,
  balance,
  installmentProjection,
  type State,
} from "../src/domain/finance";
import { makeBackup, readBackup, validateState } from "../src/domain/backup";
import { reconcile } from "../src/domain/sync";
const fixture = (principal = 100, interest = 0, count = 3): State =>
  apply(
    {
      ...initialState,
      accounts: [
        {
          id: "card",
          name: "Tarjeta",
          type: "credit",
          openingBalance: 0,
          active: true,
        },
      ],
    },
    {
      kind: "recurring",
      value: {
        id: "loan",
        type: "installment",
        accountId: "card",
        categoryId: "other",
        amount: principal,
        startDate: "2026-01-31",
        nextDate: "2026-01-31",
        active: true,
        note: "Compra",
        installments: { principal, interest, count, paid: 0, paidAmount: 0 },
      },
    },
  );
test("distributes integer CLP exactly, with interest, restores original day after February and stops", () => {
  const s = processRecurring(fixture(100, 1), "2027-01-01");
  assert.deepEqual(
    s.transactions.map((t) => [t.date, t.amount]),
    [
      ["2026-01-31", 34],
      ["2026-02-28", 34],
      ["2026-03-31", 33],
    ],
  );
  assert.equal(balance(s, "card"), -101);
  assert.equal(s.recurring[0].active, false);
  assert.deepEqual(processRecurring(s, "2027-01-01"), s);
  assert.deepEqual(readBackup(makeBackup(s)), s);
});
test("monthly spending includes only posted installments; future amounts are projections", () => {
  const s = processRecurring(fixture(), "2026-01-31");
  assert.equal(monthly(s, "2026-01").expense, 34);
  assert.equal(monthly(s, "2026-02").expense, 0);
  assert.equal(installmentProjection(s, "2026-02"), 33);
  assert.equal(installmentProjection(s, "2026-04"), 0);
  assert.equal(s.transactions.length, 1);
});
test("editing count redistributes outstanding principal without rewriting paid entries", () => {
  let s = processRecurring(fixture(), "2026-02-28");
  const history = [...s.transactions];
  s = apply(s, {
    kind: "resize-installments",
    id: "loan",
    count: 5,
    date: "2026-02-28",
  });
  assert.deepEqual(s.transactions, history);
  assert.equal(s.recurring[0].amount, 11);
  s = processRecurring(s, "2027-01-01");
  assert.deepEqual(
    s.transactions.map((t) => t.amount),
    [34, 33, 11, 11, 11],
  );
  assert.equal(balance(s, "card"), -100);
});
test("invalid edits cannot remove posted installments or create zero-value payments", () => {
  const s = processRecurring(fixture(), "2026-02-28");
  for (const count of [0, 1, 2, 36, 601, 3.5, NaN])
    assert.throws(() =>
      apply(s, {
        kind: "resize-installments",
        id: "loan",
        count,
        date: "2026-02-28",
      }),
    );
  assert.throws(() =>
    apply(s, {
      kind: "resize-installments",
      id: "loan",
      count: 4,
      date: "2026-01-01",
    }),
  );
});
test("early settlement posts due payments first, charges the remainder once and cancels future", () => {
  let s = apply(fixture(100, 20), {
    kind: "settle-installments",
    id: "loan",
    date: "2026-02-15",
  });
  assert.deepEqual(
    s.transactions.map((t) => [t.date, t.amount]),
    [
      ["2026-01-31", 40],
      ["2026-02-15", 80],
    ],
  );
  assert.equal(monthly(s, "2026-02").expense, 80);
  assert.equal(s.recurring[0].installments?.settledAt, "2026-02-15");
  assert.deepEqual(
    apply(s, { kind: "settle-installments", id: "loan", date: "2026-02-15" }),
    s,
  );
  assert.deepEqual(processRecurring(s, "2028-01-01"), s);
  assert.deepEqual(apply(s, { kind: "toggle-recurring", id: "loan" }), s);
  assert.deepEqual(readBackup(makeBackup(s)), s);
});
test("can pay before first due date without charging the first installment twice", () => {
  const s = apply(fixture(), {
    kind: "settle-installments",
    id: "loan",
    date: "2026-01-15",
  });
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].amount, 100);
  assert.equal(installmentProjection(s, "2026-01"), 0);
});
test("paused plans keep unpaid schedule, resume catches up and then terminates", () => {
  let s = apply(fixture(), { kind: "toggle-recurring", id: "loan" });
  assert.equal(processRecurring(s, "2027-01-01").transactions.length, 0);
  assert.equal(installmentProjection(s, "2026-02"), 0);
  s = processRecurring(
    apply(s, { kind: "toggle-recurring", id: "loan" }),
    "2027-01-01",
  );
  assert.equal(s.transactions.length, 3);
  assert.equal(s.recurring[0].active, false);
});
test("rejects invalid plans, income plans and attempts to replace a payment history", () => {
  for (const args of [
    [1, 0, 3],
    [100, -1, 3],
    [100, 0, 0],
    [100, 0, 601],
    [1e12, 1, 3],
  ])
    assert.throws(() => fixture(...(args as [number, number, number])));
  const s = fixture();
  const r = s.recurring[0];
  assert.throws(() => apply(s, { kind: "recurring", value: r }));
  assert.throws(() =>
    apply(initialState, { kind: "recurring", value: { ...r, type: "income" } }),
  );
});
test("cannot alter amount, account or date of paid installments through activity", () => {
  const s = processRecurring(fixture(), "2026-01-31"),
    t = s.transactions[0];
  for (const change of [
    { amount: 35 },
    { date: "2026-02-01" },
    { accountId: "missing" },
  ])
    assert.throws(() =>
      apply(s, { kind: "update-transaction", value: { ...t, ...change } }),
    );
  assert.equal(
    apply(s, {
      kind: "update-transaction",
      value: { ...t, note: "Aclaración" },
    }).transactions[0].note,
    "Aclaración",
  );
});
test("backup rejects missing payments and forged progress; older recurring rules remain valid", () => {
  const s = processRecurring(fixture(), "2026-01-31");
  assert.throws(() => validateState({ ...s, transactions: [] }));
  const { installments, ...old } = s.recurring[0];
  const legacy = {
    ...initialState,
    accounts: s.accounts,
    recurring: [{ ...old, type: "expense" as const }],
  };
  assert.deepEqual(readBackup(makeBackup(legacy)), legacy);
  assert.equal(processRecurring(legacy, "2026-12-31").transactions.length, 11);
});
test("transport between devices preserves plan progress, edited schedule and settlement", async () => {
  let state = apply(processRecurring(fixture(), "2026-01-31"), {
    kind: "resize-installments",
    id: "loan",
    count: 4,
    date: "2026-01-31",
  });
  state = apply(state, {
    kind: "settle-installments",
    id: "loan",
    date: "2026-02-01",
  });
  const remote = readBackup(makeBackup(state));
  const result = await reconcile(
    { state: initialState, revision: 0, dirty: false },
    { state: remote, revision: 5 },
    async () => {
      throw Error("unexpected write");
    },
  );
  assert.deepEqual(result.state, state);
  assert.equal(result.revision, 5);
});
test("old recurring readers reject the new discriminator instead of stripping installment metadata", () => {
  const oldRecurring = transactionSchema
    .omit({ id: true, date: true })
    .extend({
      id: z.string().min(1),
      startDate: dateSchema,
      nextDate: dateSchema,
      active: z.boolean(),
    });
  const s = fixture();
  assert.equal(oldRecurring.safeParse(s.recurring[0]).success, false);
  assert.equal(s.version, 1); // The current Supabase JSON envelope remains compatible.
  const r = s.recurring[0];
  assert.throws(() =>
    validateState({ ...s, recurring: [{ ...r, installments: undefined }] }),
  );
  assert.throws(() =>
    validateState({ ...s, recurring: [{ ...r, type: "expense" }] }),
  );
});
test("stale schedules cannot replay an already posted installment", () => {
  const s = processRecurring(fixture(), "2026-01-31");
  const corrupt = {
    ...s,
    recurring: [{ ...s.recurring[0], nextDate: "2026-01-31" }],
  };
  assert.throws(() => validateState(corrupt));
  assert.throws(() => processRecurring(corrupt, "2026-02-28"), /duplicados/);
});
