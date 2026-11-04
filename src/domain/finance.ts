import { z } from "zod";
import { dateSchema } from "./dates";
import { agendaEventSchema, AgendaEvent } from "./agenda";
export { dateSchema } from "./dates";

export const amountSchema = z.number().int().positive().max(1_000_000_000_000);
const name = z.string().trim().min(1).max(80);
export const accountSchema = z.object({
  id: z.string(),
  name,
  type: z.enum(["bank", "cash", "credit"]),
  bank: z.string().trim().max(80).optional(),
  bankType: z.enum(["checking", "sight"]).optional(),
  maintenanceFee: z.number().int().min(0).max(1e12).optional(),
  creditLimit: z.number().int().min(0).max(1e12).optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  openingBalance: z.number().int().min(-1e12).max(1e12),
  active: z.boolean(),
});
export const transactionSchema = z.object({
  id: z.string(),
  type: z.enum(["income", "expense"]),
  accountId: z.string(),
  categoryId: z.string(),
  amount: amountSchema,
  date: dateSchema,
  note: z.string().max(250),
});
export const transferSchema = z
  .object({
    id: z.string(),
    fromId: z.string(),
    toId: z.string(),
    amount: amountSchema,
    date: dateSchema,
  })
  .refine((t) => t.fromId !== t.toId, "Elige dos cuentas distintas");
const categorySchema = z.object({
  id: z.string(),
  name,
  type: z.enum(["income", "expense"]),
});
export const budgetSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amount: amountSchema,
});
export const goalSchema = z.object({
  id: z.string(),
  name,
  target: amountSchema,
  accountId: z.string(),
});
export const contributionSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  amount: amountSchema,
  date: dateSchema,
});
export const installmentSchema = z
  .object({
    principal: amountSchema,
    interest: z.number().int().min(0).max(1e12),
    count: z.number().int().min(1).max(600),
    paid: z.number().int().min(0).max(600),
    paidAmount: z.number().int().min(0).max(1e12),
    settledAt: dateSchema.optional(),
  })
  .refine(
    (p) =>
      p.principal + p.interest <= 1e12 &&
      p.paid <= p.count &&
      p.paidAmount <= p.principal + p.interest &&
      (p.paid === 0 ? p.paidAmount === 0 : p.paidAmount > 0) &&
      (p.paid === p.count
        ? p.paidAmount === p.principal + p.interest
        : p.principal + p.interest - p.paidAmount >= p.count - p.paid) &&
      (!p.settledAt || p.paid === p.count),
    "Plan de cuotas incompatible",
  );
export type Installments = z.infer<typeof installmentSchema>;
export const installmentTotal = (p: Installments) => p.principal + p.interest;
export const installmentRemaining = (p: Installments) =>
  installmentTotal(p) - p.paidAmount;
export const nextInstallmentAmount = (p: Installments) =>
  p.paid === p.count
    ? 0
    : Math.ceil(installmentRemaining(p) / (p.count - p.paid));
export const recurringSchema = transactionSchema
  .omit({ id: true, date: true, type: true })
  .extend({
    id: z.string().min(1),
    startDate: dateSchema,
    nextDate: dateSchema,
    active: z.boolean(),
    installments: installmentSchema.optional(),
    type: z.enum(["expense", "income", "installment"]),
  })
  .refine(
    (r) =>
      (!r.installments && r.type !== "installment") ||
      (r.type === "installment" &&
        !!r.installments &&
        (r.installments.paid < r.installments.count || !r.active)),
    "Revisa el estado del plan",
  );
export const stateSchema = z.object({
  version: z.literal(1),
  events: z.array(agendaEventSchema).default([]),
  recurring: z.array(recurringSchema).default([]),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  transfers: z.array(transferSchema),
  budgets: z.array(budgetSchema),
  goals: z.array(goalSchema),
  contributions: z.array(contributionSchema),
});
export type State = z.infer<typeof stateSchema>;
export type Account = State["accounts"][number];
export type Transaction = State["transactions"][number];
export type Command =
  | { kind: "event" | "update-event"; value: AgendaEvent }
  | { kind: "delete-event"; id: string }
  | { kind: "recurring"; value: z.infer<typeof recurringSchema> }
  | { kind: "toggle-recurring"; id: string }
  | { kind: "resize-installments"; id: string; count: number; date: string }
  | { kind: "settle-installments"; id: string; date: string }
  | { kind: "process-recurring"; date: string }
  | { kind: "account"; value: Account }
  | { kind: "update-account"; value: Account }
  | { kind: "transaction"; value: Transaction }
  | { kind: "update-transaction"; value: Transaction }
  | { kind: "category"; value: State["categories"][number] }
  | { kind: "transfer"; value: State["transfers"][number] }
  | { kind: "budget"; value: State["budgets"][number] }
  | { kind: "goal"; value: State["goals"][number] }
  | { kind: "contribution"; value: State["contributions"][number] };
export const initialState: State = {
  version: 1,
  events: [],
  recurring: [],
  accounts: [],
  transactions: [],
  transfers: [],
  budgets: [],
  goals: [],
  contributions: [],
  categories: [
    { id: "salary", name: "Sueldo", type: "income" },
    { id: "other-income", name: "Otros ingresos", type: "income" },
    { id: "food", name: "Alimentación", type: "expense" },
    { id: "home", name: "Hogar", type: "expense" },
    { id: "transport", name: "Transporte", type: "expense" },
    { id: "health", name: "Salud", type: "expense" },
    { id: "leisure", name: "Ocio", type: "expense" },
    { id: "other", name: "Otros gastos", type: "expense" },
  ],
};
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const clp = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
export function balance(s: State, id: string): number {
  return (
    (s.accounts.find((a) => a.id === id)?.openingBalance ?? 0) +
    s.transactions
      .filter((t) => t.accountId === id)
      .reduce((v, t) => v + (t.type === "income" ? t.amount : -t.amount), 0) +
    s.transfers.reduce(
      (v, t) =>
        v + (t.toId === id ? t.amount : 0) - (t.fromId === id ? t.amount : 0),
      0,
    )
  );
}
export function monthly(s: State, month: string) {
  return s.transactions
    .filter((t) => t.date.startsWith(month))
    .reduce(
      (v, t) => ({
        income: v.income + (t.type === "income" ? t.amount : 0),
        expense: v.expense + (t.type === "expense" ? t.amount : 0),
      }),
      { income: 0, expense: 0 },
    );
}
export const spent = (s: State, categoryId: string, month: string) =>
  s.transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.categoryId === categoryId &&
        t.date.startsWith(month),
    )
    .reduce((v, t) => v + t.amount, 0);
export const contributed = (s: State, goalId: string) =>
  s.contributions
    .filter((c) => c.goalId === goalId)
    .reduce((v, c) => v + c.amount, 0);
export function possibleDuplicate(s: State, t: Transaction) {
  return s.transactions.some(
    (x) =>
      x.id !== t.id &&
      x.accountId === t.accountId &&
      x.amount === t.amount &&
      x.date === t.date &&
      x.type === t.type &&
      x.categoryId === t.categoryId,
  );
}
export function apply(s: State, c: Command): State {
  const account = (id: string) => {
    const a = s.accounts.find((a) => a.id === id && a.active);
    if (!a) throw new Error("Selecciona una cuenta activa");
    return a;
  };
  const append = <
    K extends
      | "accounts"
      | "transactions"
      | "transfers"
      | "budgets"
      | "goals"
      | "contributions",
  >(
    key: K,
    value: State[K][number],
  ): State => {
    if (s[key].some((x) => x.id === value.id)) return s;
    return { ...s, [key]: [...s[key], value] };
  };
  switch (c.kind) {
    case "event":
    case "update-event": {
      const event = agendaEventSchema.parse(c.value);
      const exists = s.events.some((e) => e.id === event.id);
      if (c.kind === "event" && exists) return s;
      if (c.kind === "update-event" && !exists)
        throw new Error("Evento no encontrado");
      return {
        ...s,
        events: exists
          ? s.events.map((e) => (e.id === event.id ? event : e))
          : [...s.events, event],
      };
    }
    case "delete-event":
      return { ...s, events: s.events.filter((e) => e.id !== c.id) };

    case "recurring": {
      const r = recurringSchema.parse(c.value);
      account(r.accountId);
      if (s.recurring.some((x) => x.id === r.id && x.installments))
        throw new Error("Usa Editar cuotas para modificar un plan existente");
      if (
        r.installments &&
        (r.nextDate !== r.startDate ||
          r.installments.paid !== 0 ||
          r.installments.paidAmount !== 0 ||
          r.installments.settledAt ||
          s.transactions.some(
            (t) =>
              t.id.startsWith(`recurring:${r.id}:`) ||
              t.id === `installment-settle:${r.id}`,
          ))
      )
        throw new Error("Un nuevo plan debe comenzar sin cuotas registradas");
      if (
        r.nextDate < r.startDate ||
        !s.categories.some(
          (x) =>
            x.id === r.categoryId &&
            x.type === (r.type === "installment" ? "expense" : r.type),
        )
      )
        throw new Error("Revisa la fecha y categoría del recurrente");
      return {
        ...s,
        recurring: [
          ...s.recurring.filter((x) => x.id !== r.id),
          {
            ...r,
            amount: r.installments
              ? nextInstallmentAmount(r.installments)
              : r.amount,
          },
        ],
      };
    }
    case "toggle-recurring":
      return {
        ...s,
        recurring: s.recurring.map((r) =>
          r.id === c.id &&
          (!r.installments || r.installments.paid < r.installments.count)
            ? { ...r, active: !r.active }
            : r,
        ),
      };
    case "resize-installments":
    case "settle-installments": {
      dateSchema.parse(c.date);
      const old = s.recurring.find((r) => r.id === c.id);
      if (!old?.installments) throw new Error("Plan de cuotas no encontrado");
      if (old.installments.paid === old.installments.count) return s;
      const related = s.transactions.filter((t) =>
        t.id.startsWith(`recurring:${c.id}:`),
      );
      if (related.some((t) => t.date > c.date))
        throw new Error("La fecha no puede preceder cuotas ya registradas");
      const updated = processRecurring(s, c.date);
      const rule = updated.recurring.find((r) => r.id === c.id)!;
      const p = rule.installments!;
      if (p.paid === p.count) return updated;
      if (c.kind === "resize-installments") {
        if (
          !Number.isInteger(c.count) ||
          c.count <= p.paid ||
          c.count > 600 ||
          c.count - p.paid > installmentRemaining(p)
        )
          throw new Error(
            "El total de cuotas debe superar las registradas, hasta 600, con al menos $1 por cuota",
          );
        const plan = installmentSchema.parse({ ...p, count: c.count });
        return {
          ...updated,
          recurring: updated.recurring.map((r) =>
            r.id === c.id
              ? {
                  ...r,
                  installments: plan,
                  amount: nextInstallmentAmount(plan),
                }
              : r,
          ),
        };
      }
      account(rule.accountId);
      const paidState = apply(updated, {
        kind: "transaction",
        value: {
          id: `installment-settle:${c.id}`,
          type: "expense",
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          amount: installmentRemaining(p),
          date: c.date,
          note: `Pago anticipado · ${rule.note || "Compra en cuotas"}`.slice(
            0,
            250,
          ),
        },
      });
      return {
        ...paidState,
        recurring: paidState.recurring.map((r) =>
          r.id === c.id
            ? {
                ...r,
                active: false,
                installments: {
                  ...p,
                  paid: p.count,
                  paidAmount: installmentTotal(p),
                  settledAt: c.date,
                },
              }
            : r,
        ),
      };
    }
    case "process-recurring":
      return processRecurring(s, c.date);

    case "update-account": {
      const a = accountSchema.parse(c.value),
        old = account(a.id);
      if (old.type !== a.type || old.openingBalance !== a.openingBalance)
        throw new Error(
          "La edición de datos no permite cambiar el tipo base ni el saldo inicial",
        );
      return { ...s, accounts: s.accounts.map((x) => (x.id === a.id ? a : x)) };
    }
    case "account": {
      const a = accountSchema.parse(c.value);
      return append("accounts", a);
    }
    case "category": {
      const category = categorySchema.parse(c.value);
      const old = s.categories.find((x) => x.id === category.id);
      if (old && old.type !== category.type)
        throw new Error(
          "No se puede cambiar el tipo de una categoría existente",
        );
      if (
        s.categories.some(
          (x) =>
            x.id !== category.id &&
            x.type === category.type &&
            x.name.normalize("NFKC").toLocaleLowerCase("es") ===
              category.name.normalize("NFKC").toLocaleLowerCase("es"),
        )
      )
        throw new Error("Ya existe una categoría con ese nombre");
      return {
        ...s,
        categories: old
          ? s.categories.map((x) => (x.id === category.id ? category : x))
          : [...s.categories, category],
      };
    }
    case "update-transaction":
    case "transaction": {
      const t = transactionSchema.parse(c.value);
      account(t.accountId);
      if (!s.categories.some((x) => x.id === t.categoryId && x.type === t.type))
        throw new Error("Categoría incompatible");
      if (c.kind === "update-transaction") {
        const old = s.transactions.find((x) => x.id === t.id);
        if (!old) throw new Error("Movimiento no encontrado");
        const plan = s.recurring.find(
          (r) =>
            r.installments &&
            (t.id.startsWith(`recurring:${r.id}:`) ||
              t.id === `installment-settle:${r.id}`),
        );
        if (
          plan &&
          (old.amount !== t.amount ||
            old.accountId !== t.accountId ||
            old.date !== t.date)
        )
          throw new Error(
            "Las cuotas registradas conservan monto, cuenta y fecha; edita solo su nota o categoría",
          );
        if (old.type !== t.type)
          throw new Error("No se puede cambiar el tipo del movimiento");
        return {
          ...s,
          transactions: s.transactions.map((x) => (x.id === t.id ? t : x)),
        };
      }
      return append("transactions", t);
    }
    case "transfer": {
      const t = transferSchema.parse(c.value);
      account(t.fromId);
      account(t.toId);
      return append("transfers", t);
    }
    case "budget": {
      const b = budgetSchema.parse(c.value);
      if (
        !s.categories.some((x) => x.id === b.categoryId && x.type === "expense")
      )
        throw new Error("Selecciona una categoría de gasto");
      return {
        ...s,
        budgets: [
          ...s.budgets.filter(
            (x) => x.categoryId !== b.categoryId || x.month !== b.month,
          ),
          b,
        ],
      };
    }
    case "goal": {
      const g = goalSchema.parse(c.value);
      if (account(g.accountId).type === "credit")
        throw new Error("Una meta necesita una cuenta de efectivo o bancaria");
      return append("goals", g);
    }
    case "contribution": {
      const v = contributionSchema.parse(c.value);
      if (s.contributions.some((x) => x.id === v.id)) return s;
      const g = s.goals.find((x) => x.id === v.goalId);
      if (!g) throw new Error("Selecciona una meta");
      account(g.accountId);
      const reserved = s.goals
        .filter((x) => x.accountId === g.accountId)
        .reduce((n, x) => n + contributed(s, x.id), 0);
      if (v.amount > balance(s, g.accountId) - reserved)
        throw new Error(
          "Saldo sin asignar insuficiente en la cuenta de ahorro",
        );
      if (contributed(s, g.id) + v.amount > g.target)
        throw new Error("El aporte supera lo pendiente de la meta");
      return append("contributions", v);
    }
  }
}

// El día original se conserva al pasar por meses cortos (31 → 28 → 31).
export function nextMonthly(date: string, anchor: string): string {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(y, m, Math.min(Number(anchor.slice(8)), last)));
  return d.toISOString().slice(0, 10);
}
export function processRecurring(state: State, through: string): State {
  dateSchema.parse(through);
  let s = state;
  const recurring = state.recurring.map((rule) => {
    let nextDate = rule.nextDate;
    let count = 0;
    let plan = rule.installments ? { ...rule.installments } : undefined;
    while (
      rule.active &&
      (!plan || plan.paid < plan.count) &&
      nextDate <= through
    ) {
      if (++count > 1200)
        throw new Error("El recurrente supera 100 años de historial");
      const { id, startDate, active, ...t } = rule;
      if (
        plan &&
        s.transactions.some((t) => t.id === `recurring:${id}:${nextDate}`)
      )
        throw new Error(
          "El historial de cuotas requiere revisión; no se generaron cargos duplicados",
        );
      s = apply(s, {
        kind: "transaction",
        value: {
          ...t,
          type: rule.type === "installment" ? "expense" : rule.type,
          id: `recurring:${id}:${nextDate}`,
          date: nextDate,
          amount: plan ? nextInstallmentAmount(plan) : rule.amount,
          note: plan
            ? `${rule.note || "Compra en cuotas"} · Cuota ${plan.paid + 1}/${plan.count}`.slice(
                0,
                250,
              )
            : rule.note,
        },
      });
      if (plan)
        plan = {
          ...plan,
          paid: plan.paid + 1,
          paidAmount: plan.paidAmount + nextInstallmentAmount(plan),
        };
      nextDate = nextMonthly(nextDate, startDate);
    }
    return {
      ...rule,
      nextDate,
      ...(plan
        ? {
            installments: plan,
            active: rule.active && plan.paid < plan.count,
            amount:
              plan.paid < plan.count
                ? nextInstallmentAmount(plan)
                : rule.amount,
          }
        : {}),
    };
  });
  return { ...s, recurring };
}

export function bankTotal(s: State): number {
  return s.accounts
    .filter((a) => a.type === "bank")
    .reduce((n, a) => n + balance(s, a.id), 0);
}
export function creditSummary(s: State, a: Account) {
  const debt = Math.max(0, -balance(s, a.id));
  return {
    debt,
    limit: a.creditLimit ?? null,
    available:
      a.creditLimit === undefined ? null : Math.max(0, a.creditLimit - debt),
  };
}
export function monthLabel(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return "mes seleccionado";
  const d = new Date(`${month}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CL", {
    month: "long",
    timeZone: "UTC",
  }).format(d);
}
export function accountTypeLabel(a: Account): string {
  return a.type === "credit"
    ? "Tarjeta de crédito"
    : a.type === "cash"
      ? "Efectivo"
      : a.bankType === "checking"
        ? "Cuenta corriente"
        : a.bankType === "sight"
          ? "Cuenta vista"
          : "Cuenta bancaria";
}

// Todos los gastos del mes, agrupados por el medio de pago de la cuenta.
// Las transferencias históricas y los saldos iniciales no son gastos.
export function expensesByAccountType(s: State, month: string) {
  const totals: Record<string, number> = {
    "Tarjeta de crédito": 0,
    "Cuenta vista": 0,
    "Cuenta corriente": 0,
    Efectivo: 0,
    "Cuenta bancaria": 0,
  };
  for (const t of s.transactions) {
    if (t.type !== "expense" || !t.date.startsWith(`${month}-`)) continue;
    const a = s.accounts.find((a) => a.id === t.accountId);
    const label = a ? accountTypeLabel(a) : "Sin cuenta";
    totals[label] = (totals[label] ?? 0) + t.amount;
  }
  return Object.entries(totals).map(([name, total]) => ({ name, total }));
}

/** Pending installments only; does not alter actual spending or account balances. */
export function installmentProjection(s: State, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mes inválido");
  let total = 0;
  for (const r of s.recurring) {
    if (!r.active || !r.installments) continue;
    let p = { ...r.installments },
      date = r.nextDate;
    while (p.paid < p.count && date.slice(0, 7) <= month) {
      const amount = nextInstallmentAmount(p);
      if (date.startsWith(month)) total += amount;
      p = { ...p, paid: p.paid + 1, paidAmount: p.paidAmount + amount };
      date = nextMonthly(date, r.startDate);
    }
  }
  return total;
}
