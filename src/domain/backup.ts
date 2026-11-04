import { z } from "zod";
import { State, stateSchema, nextMonthly } from "./finance";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const envelope = z.object({
  format: z.literal("qgasto-backup"),
  version: z.literal(1),
  createdAt: z.string().datetime(),
  data: stateSchema,
});
export function validateState(input: unknown): State {
  const s = stateSchema.parse(input);
  for (const list of [
    s.accounts,
    s.categories,
    s.transactions,
    s.transfers,
    s.budgets,
    s.goals,
    s.contributions,
    s.recurring,
    s.events,
  ]) {
    const ids = list.map((x) => x.id);
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new Error("IDs vacíos o duplicados");
  }
  const account = (id: string) => s.accounts.some((a) => a.id === id);
  const category = (id: string, type: string) =>
    s.categories.some((c) => c.id === id && c.type === type);
  for (const t of [...s.transactions, ...s.recurring])
    if (
      !account(t.accountId) ||
      !category(t.categoryId, t.type === "installment" ? "expense" : t.type)
    )
      throw new Error("Movimiento con referencias inválidas");
  for (const t of s.transfers)
    if (!account(t.fromId) || !account(t.toId))
      throw new Error("Transferencia histórica inválida");
  for (const b of s.budgets)
    if (!category(b.categoryId, "expense"))
      throw new Error("Presupuesto inválido");
  if (
    new Set(s.budgets.map((b) => `${b.month}:${b.categoryId}`)).size !==
    s.budgets.length
  )
    throw new Error("Presupuestos duplicados");
  for (const g of s.goals)
    if (!account(g.accountId)) throw new Error("Meta sin cuenta");
  for (const c of s.contributions)
    if (!s.goals.some((g) => g.id === c.goalId))
      throw new Error("Aporte sin meta");
  for (const r of s.recurring)
    if (r.nextDate < r.startDate) throw new Error("Fecha recurrente inválida");
  for (const r of s.recurring) {
    if (!r.installments) continue;
    const payments = s.transactions.filter((t) =>
      t.id.startsWith(`recurring:${r.id}:`),
    );
    const settlement = s.transactions.find(
      (t) => t.id === `installment-settle:${r.id}`,
    );
    let next = r.startDate;
    for (const payment of [...payments].sort((a, b) =>
      a.date.localeCompare(b.date),
    )) {
      if (
        payment.date !== next ||
        payment.id !== `recurring:${r.id}:${next}` ||
        payment.accountId !== r.accountId ||
        payment.type !== "expense"
      )
        throw new Error("Calendario de cuotas incompatible con sus pagos");
      next = nextMonthly(next, r.startDate);
    }
    if (next !== r.nextDate)
      throw new Error("Fecha de próxima cuota incompatible");
    const amount =
      payments.reduce((n, t) => n + t.amount, 0) + (settlement?.amount ?? 0);
    if (
      amount !== r.installments.paidAmount ||
      (!r.installments.settledAt && payments.length !== r.installments.paid) ||
      !!settlement !== !!r.installments.settledAt ||
      (settlement && settlement.date !== r.installments.settledAt)
    )
      throw new Error("El historial de cuotas no coincide con el plan");
  }
  return s;
}
export function makeBackup(s: State): string {
  const text = JSON.stringify(
    {
      format: "qgasto-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      data: validateState(s),
    },
    null,
    2,
  );
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("La copia supera el límite de 10 MB");
  return text;
}
export function readBackup(text: string): State {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("La copia supera el límite de 10 MB");
  try {
    return validateState(
      envelope.parse(JSON.parse(text.replace(/^\uFEFF/, ""))).data,
    );
  } catch (e) {
    throw new Error(
      `Copia inválida o incompatible. No se modificaron tus datos. ${e instanceof Error && e.name !== "ZodError" ? e.message : ""}`,
    );
  }
}
