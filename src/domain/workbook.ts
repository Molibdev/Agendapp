import * as XLSX from "xlsx";
import { State, balance, monthly, contributed, dateSchema } from "./finance";
export function createWorkbook(s: State, from: string, to: string) {
  dateSchema.parse(from);
  dateSchema.parse(to);
  if (from > to)
    throw new Error("La fecha inicial debe ser anterior a la final");
  const inRange = (date: string) => date >= from && date <= to;
  const transactions = s.transactions.filter((t) => inRange(t.date));
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((n, t) => n + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((n, t) => n + t.amount, 0);
  const account = (id: string) =>
    s.accounts.find((a) => a.id === id)?.name ?? id;
  const category = (id: string) =>
    s.categories.find((c) => c.id === id)?.name ?? id;
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add("Resumen", [
    ["Desde", "Hasta", "Moneda", "Ingresos", "Gastos", "Resultado"],
    [from, to, "CLP", income, expense, income - expense],
  ]);
  add("Movimientos", [
    ["ID", "Fecha", "Tipo", "Cuenta", "Categoría", "Monto CLP", "Nota"],
    ...transactions.map((t) => [
      t.id,
      t.date,
      t.type,
      account(t.accountId),
      category(t.categoryId),
      t.amount,
      t.note,
    ]),
  ]);
  add("Transferencias", [
    ["ID", "Fecha", "Origen", "Destino", "Monto CLP"],
    ...s.transfers
      .filter((t) => inRange(t.date))
      .map((t) => [t.id, t.date, account(t.fromId), account(t.toId), t.amount]),
  ]);
  add("Cuentas", [
    [
      "ID",
      "Nombre",
      "Tipo",
      "Saldo inicial CLP",
      "Saldo actual CLP",
      "Banco / emisor",
      "Tipo bancario",
      "Mantención mensual CLP",
      "Cupo total CLP",
      "Día de facturación",
    ],
    ...s.accounts.map((a) => [
      a.id,
      a.name,
      a.type,
      a.openingBalance,
      balance(s, a.id),
      a.bank ?? "",
      a.bankType ?? "",
      a.maintenanceFee ?? "",
      a.creditLimit ?? "",
      a.billingDay ?? "",
    ]),
  ]);
  add("Categorías", [
    ["ID", "Nombre", "Tipo"],
    ...s.categories.map((c) => [c.id, c.name, c.type]),
  ]);
  add("Presupuestos", [
    ["Mes", "Categoría", "Monto CLP"],
    ...s.budgets
      .filter((b) => b.month >= from.slice(0, 7) && b.month <= to.slice(0, 7))
      .map((b) => [b.month, category(b.categoryId), b.amount]),
  ]);
  add("Recurrentes", [
    [
      "ID",
      "Cuenta",
      "Categoría",
      "Monto CLP",
      "Inicio",
      "Próxima fecha",
      "Activo",
      "Nota",
      "Precio compra CLP",
      "Interés total CLP",
      "Cuotas totales",
      "Cuotas registradas",
      "Pendiente CLP",
      "Pago anticipado",
      "Retirado de la lista",
    ],
    ...s.recurring.map((r) => [
      r.id,
      account(r.accountId),
      category(r.categoryId),
      r.amount,
      r.startDate,
      r.nextDate,
      r.active,
      r.note,
      r.installments?.principal ?? "",
      r.installments?.interest ?? "",
      r.installments?.count ?? "",
      r.installments?.paid ?? "",
      r.installments
        ? r.installments.principal +
          r.installments.interest -
          r.installments.paidAmount
        : "",
      r.installments?.settledAt ?? "",
      r.archived ?? false,
    ]),
  ]);
  add("Metas", [
    [
      "Nombre",
      "Cuenta",
      "Objetivo CLP",
      "Acumulado actual CLP",
      "Aportes en intervalo CLP",
    ],
    ...s.goals.map((g) => [
      g.name,
      account(g.accountId),
      g.target,
      contributed(s, g.id),
      s.contributions
        .filter((c) => c.goalId === g.id && inRange(c.date))
        .reduce((n, c) => n + c.amount, 0),
    ]),
  ]);
  const months = [
    ...new Set(transactions.map((t) => t.date.slice(0, 7))),
  ].sort();
  const filtered = { ...s, transactions };
  add("Reportes", [
    ["Mes", "Ingresos CLP", "Gastos CLP", "Resultado CLP"],
    ...months.map((m) => {
      const v = monthly(filtered, m);
      return [m, v.income, v.expense, v.income - v.expense];
    }),
  ]);
  return wb;
}
