import * as XLSX from "xlsx";
import {
  State,
  balance,
  dateSchema,
  installmentProjection,
  installmentRemaining,
  installmentTotal,
  accountTypeLabel,
} from "./finance";
import { validateState } from "./backup";
export type ColumnKind = "text" | "money" | "percent" | "integer" | "date";
export type ReportSection = {
  titleRow: number;
  headerRow: number;
  firstRow: number;
  lastRow: number;
  count: number;
  columns: number;
  startCol: number;
};
export type ReportStats = {
  income: number;
  expense: number;
  net: number;
  monthExpense: number;
  yearIncome: number;
  yearExpense: number;
  pending: number;
  year: string;
  month: string;
  from: string;
  to: string;
};
export type ReportChart = {
  kind: "bar" | "doughnut";
  title: string;
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
  labels: string[];
  labelRange: string;
  series: { name: string; values: number[]; range: string; color: string }[];
};
export type ReportLayout = {
  styles: Record<string, number>;
  sections: Record<string, ReportSection>;
  charts: ReportChart[];
  stats: ReportStats;
  printEnd: number;
};
export type ReportWorkbook = XLSX.WorkBook & { report: ReportLayout };
export const REPORT_SHEET = "Agendapp";
const day = (s: string) => s.split("-").reverse().join("/");
const dateValue = (s: string): number | string =>
  s < "1900-01-01"
    ? day(s)
    : Date.parse(s + "T00:00:00Z") / 86400000 +
      25569 -
      (s < "1900-03-01" ? 1 : 0);
const rate = (income: number, expense: number) =>
  income > 0 ? (income - expense) / income : null;
/** A literal report: user text never becomes a formula or an external link. */
export function createWorkbook(
  input: State,
  from: string,
  to: string,
): ReportWorkbook {
  dateSchema.parse(from);
  dateSchema.parse(to);
  if (from > to) throw Error("La fecha inicial debe ser anterior a la final");
  const s = validateState(input),
    year = to.slice(0, 4),
    month = to.slice(0, 7),
    monthStart = month + "-01",
    yearStart = year + "-01-01";
  const inRange = (d: string) => d >= from && d <= to;
  const sum = (
    type: "income" | "expense",
    start: string,
    end: string,
    category?: string,
  ) =>
    s.transactions
      .filter(
        (t) =>
          t.type === type &&
          t.date >= start &&
          t.date <= end &&
          (!category || t.categoryId === category),
      )
      .reduce((n, t) => n + t.amount, 0);
  const stats: ReportStats = {
    income: sum("income", from, to),
    expense: sum("expense", from, to),
    net: 0,
    monthExpense: sum("expense", monthStart, to),
    yearIncome: sum("income", yearStart, to),
    yearExpense: sum("expense", yearStart, to),
    pending: installmentProjection(s, month),
    year,
    month,
    from,
    to,
  };
  stats.net = stats.income - stats.expense;
  const sheet: XLSX.WorkSheet = {},
    styles: Record<string, number> = {},
    sections: Record<string, ReportSection> = {};
  const merges: XLSX.Range[] = [],
    rows: XLSX.RowInfo[] = [];
  let maxRow = 1;
  const put = (
    r: number,
    c: number,
    value: string | number | null | boolean,
    style = 0,
  ) => {
    if (
      typeof value === "number" &&
      (!Number.isFinite(value) ||
        ((style === 7 ||
          style === 8 ||
          style === 16 ||
          style === 18 ||
          style === 21 ||
          style === 22 ||
          style === 23) &&
          !Number.isSafeInteger(value)))
    )
      throw Error("Los importes superan la precisión segura del informe");
    const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    sheet[ref] = {
      t:
        typeof value === "number"
          ? "n"
          : typeof value === "boolean"
            ? "b"
            : "s",
      v: value ?? "",
    };
    styles[ref] = style;
    maxRow = Math.max(maxRow, r);
  };
  const merged = (
    r: number,
    c: number,
    end: number,
    value: string | number | null,
    style: number,
    endRow = r,
  ) => {
    for (let rr = r; rr <= endRow; rr++)
      for (let cc = c; cc <= end; cc++) put(rr, cc, "", style);
    put(r, c, value, style);
    merges.push({
      s: { r: r - 1, c: c - 1 },
      e: { r: endRow - 1, c: end - 1 },
    });
  };
  const rowHeight = (r: number, h: number) => {
    rows[r - 1] = { ...(rows[r - 1] ?? {}), hpt: h };
  };
  const moneyStyle = (even: boolean, v: unknown) =>
    typeof v === "number" && v < 0 ? 22 : even ? 8 : 7;
  const table = (
    key: string,
    title: string,
    headers: string[],
    data: (string | number | null)[][],
    kinds: ColumnKind[],
    titleRow: number,
    col = 1,
  ): ReportSection => {
    merged(titleRow, col, col + headers.length - 1, title, 3);
    rowHeight(titleRow, 25);
    const headerRow = titleRow + 1;
    headers.forEach((h, i) => put(headerRow, col + i, h, 4));
    rowHeight(headerRow, 32);
    const displayed = data.length
      ? data
      : [["Sin registros", ...headers.slice(1).map(() => "")]];
    displayed.forEach((dataRow, i) => {
      const r = headerRow + i + 1;
      let height = 26;
      headers.forEach((_, j) => {
        const v = dataRow[j] ?? "",
          kind = kinds[j] ?? "text",
          even = i % 2 === 1;
        const st =
          kind === "money"
            ? moneyStyle(even, v)
            : kind === "percent"
              ? typeof v === "number" && (v < 0 || (key === "budgets" && v > 1))
                ? 25
                : even
                  ? 10
                  : 9
              : kind === "integer"
                ? even
                  ? 12
                  : 11
                : kind === "date"
                  ? even
                    ? 14
                    : 13
                  : even
                    ? 6
                    : 5;
        put(
          r,
          col + j,
          kind === "date" &&
            typeof v === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(v)
            ? dateValue(v)
            : v,
          st,
        );
        if (typeof v === "string")
          height = Math.max(
            height,
            Math.min(96, 14 * Math.ceil(v.length / (j === 11 ? 34 : 20)) + 10),
          );
      });
      rowHeight(r, height);
    });
    const section = {
      titleRow,
      headerRow,
      firstRow: headerRow + 1,
      lastRow: headerRow + displayed.length,
      count: data.length,
      columns: headers.length,
      startCol: col,
    };
    sections[key] = section;
    return section;
  };
  const account = (id: string) =>
    s.accounts.find((a) => a.id === id)?.name ?? id;
  const category = (id: string) =>
    s.categories.find((c) => c.id === id)?.name ?? id;
  merged(1, 1, 12, "Agendapp  |  Tu informe financiero", 1);
  rowHeight(1, 36);
  merged(2, 1, 12, "TUS CUENTAS, CON PERSPECTIVA  ·  CLP", 2);
  rowHeight(2, 23);
  merged(
    3,
    1,
    12,
    `Intervalo: ${day(from)} al ${day(to)}  ·  Corte del informe: ${day(to)}`,
    19,
  );
  rowHeight(3, 25);
  const jumpCells = [
    { c: 1, end: 3, key: "movements", label: "↓ Movimientos" },
    { c: 4, end: 6, key: "accounts", label: "↓ Cuentas" },
    { c: 7, end: 9, key: "plans", label: "↓ Cuotas y metas" },
    { c: 10, end: 12, key: "agenda", label: "↓ Agenda" },
  ];
  jumpCells.forEach((j) => merged(4, j.c, j.end, j.label, 20));
  rowHeight(4, 26);
  const cards = [
    { c: 1, label: "INGRESOS DEL INTERVALO", v: stats.income, st: 16 },
    { c: 4, label: "GASTOS DEL INTERVALO", v: stats.expense, st: 16 },
    {
      c: 7,
      label: "BALANCE DEL INTERVALO",
      v: stats.net,
      st: stats.net < 0 ? 18 : 16,
    },
    {
      c: 10,
      label: "INGRESOS QUE QUEDAN",
      v: rate(stats.income, stats.expense),
      st: 17,
    },
  ];
  cards.forEach((k) => {
    merged(6, k.c, k.c + 2, k.label, 15);
    merged(
      7,
      k.c,
      k.c + 2,
      k.v === null ? "Sin ingresos" : k.v,
      k.v !== null && k.st === 17 && k.v < 0 ? 29 : k.st,
      8,
    );
  });
  rowHeight(6, 25);
  rowHeight(7, 26);
  rowHeight(8, 15);
  [
    { c: 1, label: `GASTOS DEL MES · ${month}`, v: stats.monthExpense },
    { c: 4, label: `GASTOS DEL AÑO · ${year}`, v: stats.yearExpense },
    { c: 7, label: `INGRESOS DEL AÑO · ${year}`, v: stats.yearIncome },
    { c: 10, label: "CUOTAS PENDIENTES DEL MES", v: stats.pending },
  ].forEach((k) => {
    merged(10, k.c, k.c + 2, k.label, 15);
    merged(11, k.c, k.c + 2, k.v, 16, 12);
  });
  rowHeight(10, 27);
  rowHeight(11, 26);
  rowHeight(12, 15);
  merged(
    13,
    1,
    12,
    `Mes: ${day(monthStart)} al ${day(to)}. Acumulado anual: ${day(yearStart)} al ${day(to)}. Se excluyen movimientos posteriores al corte.`,
    19,
  );
  rowHeight(13, 24);
  merged(
    14,
    1,
    12,
    "Las cuotas pendientes son proyección de los planes actuales; no se vuelven a sumar al gasto registrado. Las transferencias no son ingresos ni gastos.",
    19,
  );
  rowHeight(14, 24);
  for (let r = 15; r <= 30; r++) rowHeight(r, 20);
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`,
      included = m <= month;
    const first = m + "-01",
      end =
        m === month
          ? to
          : new Date(Date.UTC(Number(year), i + 1, 0))
              .toISOString()
              .slice(0, 10);
    const income = included ? sum("income", first, end) : null,
      expense = included ? sum("expense", first, end) : null;
    return [
      new Intl.DateTimeFormat("es-CL", {
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${first}T12:00:00Z`)),
      income,
      expense,
      income === null || expense === null ? null : income - expense,
      income === null || expense === null ? null : rate(income, expense),
      included
        ? m === month
          ? `Al ${day(to)}`
          : "Mes completo"
        : "Fuera del corte",
    ];
  });
  const annual = table(
    "annual",
    `INGRESOS Y GASTOS · ${year}`,
    [
      "Mes",
      "Ingresos CLP",
      "Gastos CLP",
      "Balance CLP",
      "% libre",
      "Cobertura",
    ],
    months,
    ["text", "money", "money", "money", "percent", "text"],
    34,
  );
  const categories = s.categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      name: c.name,
      interval: sum("expense", from, to, c.id),
      month: sum("expense", monthStart, to, c.id),
      year: sum("expense", yearStart, to, c.id),
      budget: s.budgets
        .filter((b) => b.categoryId === c.id && b.month === month)
        .reduce((n, b) => n + b.amount, 0),
    }))
    .filter((c) => c.interval || c.month || c.year || c.budget)
    .sort(
      (a, b) => b.interval - a.interval || a.name.localeCompare(b.name, "es"),
    );
  const categoryRows = categories.map((c) => [
    c.name,
    c.interval,
    stats.expense ? c.interval / stats.expense : 0,
    c.month,
    c.year,
    c.budget,
  ]);
  if (!categoryRows.length)
    categoryRows.push(["Sin gastos registrados", 0, 0, 0, 0, 0]);
  const cat = table(
    "categories",
    "GASTOS POR CATEGORÍA",
    [
      "Categoría",
      "Gasto intervalo",
      "% intervalo",
      "Gasto mes",
      "Gasto año",
      "Presupuesto mes",
    ],
    categoryRows,
    ["text", "money", "percent", "money", "money", "money"],
    34,
    7,
  );
  merged(
    31,
    1,
    6,
    `Comparación mensual hasta ${day(to)}; no incluye meses posteriores.`,
    19,
  );
  merged(
    31,
    7,
    12,
    stats.expense
      ? "Distribución del gasto del intervalo. Se agrupan categorías menores como Otras."
      : "Sin gastos en el intervalo: el gráfico de categorías no tiene importes que representar.",
    19,
  );
  rowHeight(31, 28);
  let cursor = Math.max(annual.lastRow, cat.lastRow) + 3;
  const add = (
    key: string,
    title: string,
    headers: string[],
    data: (string | number | null)[][],
    kinds: ColumnKind[],
  ) => {
    const result = table(key, title, headers, data, kinds, cursor);
    cursor = result.lastRow + 3;
    return result;
  };
  add(
    "budgets",
    `PRESUPUESTOS · ${month} (límite mensual completo)`,
    [
      "Categoría",
      "Presupuesto CLP",
      "Gastado al corte",
      "Disponible CLP",
      "% usado",
      "Estado",
    ],
    s.budgets
      .filter((b) => b.month === month)
      .map((b) => {
        const expense = sum("expense", monthStart, to, b.categoryId);
        return [
          category(b.categoryId),
          b.amount,
          expense,
          b.amount - expense,
          expense / b.amount,
          expense > b.amount
            ? "Superado"
            : expense >= b.amount * 0.8
              ? "Cerca del límite"
              : "Dentro del presupuesto",
        ];
      }),
    ["text", "money", "money", "money", "percent", "text"],
  );
  const cutoff = {
    ...s,
    transactions: s.transactions.filter((t) => t.date <= to),
    transfers: s.transfers.filter((t) => t.date <= to),
  };
  const accounts = add(
    "accounts",
    `CUENTAS · saldos al ${day(to)} con saldo inicial registrado`,
    [
      "Cuenta",
      "Tipo",
      "Banco / emisor",
      "Estado",
      "Saldo inicial",
      "Saldo al corte",
      "Cupo CLP",
      "Deuda tarjeta",
      "Disponible tarjeta",
      "Mantención CLP",
      "Facturación día",
      "Moneda",
    ],
    s.accounts.map((a) => {
      const v = balance(cutoff, a.id),
        debt = Math.max(0, -v);
      return [
        a.name,
        accountTypeLabel(a),
        a.bank ?? "",
        a.active ? "Activa" : "Inactiva",
        a.openingBalance,
        v,
        a.type === "credit" ? (a.creditLimit ?? null) : null,
        a.type === "credit" ? debt : null,
        a.type === "credit" && a.creditLimit !== undefined
          ? Math.max(0, a.creditLimit - debt)
          : null,
        a.maintenanceFee ?? null,
        a.billingDay ?? null,
        "CLP",
      ];
    }),
    [
      "text",
      "text",
      "text",
      "text",
      "money",
      "money",
      "money",
      "money",
      "money",
      "money",
      "integer",
      "text",
    ],
  );
  merged(
    cursor - 1,
    1,
    12,
    "Los saldos incluyen el saldo inicial, cuya fecha de origen no está registrada. No equivalen al balance del intervalo. La mantención es informativa.",
    19,
  );
  rowHeight(cursor - 1, 26);
  const status = (r: State["recurring"][number]) =>
    r.archived
      ? "Retirado"
      : r.installments && r.installments.paid === r.installments.count
        ? "Pagado"
        : r.active
          ? "Activo"
          : "Pausado";
  add(
    "plans",
    "PAGOS RECURRENTES Y CUOTAS · configuración actual",
    [
      "Pago",
      "Modalidad",
      "Estado",
      "Cuenta",
      "Categoría",
      "Cuota actual CLP",
      "Inicio",
      "Próximo vencimiento",
      "Cuotas totales",
      "Cuotas cubiertas",
      "Pendiente CLP",
      "Prepago",
    ],
    s.recurring.map((r) => [
      r.note || category(r.categoryId),
      r.installments ? "Cuotas" : "Mensual",
      status(r),
      account(r.accountId),
      category(r.categoryId),
      r.amount,
      r.startDate,
      r.active ? r.nextDate : null,
      r.installments?.count ?? null,
      r.installments?.paid ?? null,
      r.installments ? installmentRemaining(r.installments) : null,
      r.installments?.settledAt ?? null,
    ]),
    [
      "text",
      "text",
      "text",
      "text",
      "text",
      "money",
      "date",
      "date",
      "integer",
      "integer",
      "money",
      "date",
    ],
  );
  add(
    "financing",
    "CONDICIONES DE LAS COMPRAS · importes totales en CLP",
    [
      "Compra",
      "Precio original",
      "Interés total",
      "Total financiado",
      "Importe cubierto",
      "Pendiente actual",
      "Estado",
    ],
    s.recurring
      .filter((r) => r.installments)
      .map((r) => [
        r.note || category(r.categoryId),
        r.installments!.principal,
        r.installments!.interest,
        installmentTotal(r.installments!),
        r.installments!.paidAmount,
        installmentRemaining(r.installments!),
        status(r),
      ]),
    ["text", "money", "money", "money", "money", "money", "text"],
  );
  add(
    "goals",
    `METAS · aportes registrados al ${day(to)}`,
    [
      "Meta",
      "Cuenta",
      "Objetivo actual CLP",
      "Aportado al corte",
      "Falta CLP",
      "% alcanzado",
      "Aportes intervalo",
    ],
    s.goals.map((g) => {
      const saved = s.contributions
        .filter((c) => c.goalId === g.id && c.date <= to)
        .reduce((n, c) => n + c.amount, 0);
      return [
        g.name,
        account(g.accountId),
        g.target,
        saved,
        Math.max(0, g.target - saved),
        saved / g.target,
        s.contributions
          .filter((c) => c.goalId === g.id && inRange(c.date))
          .reduce((n, c) => n + c.amount, 0),
      ];
    }),
    ["text", "text", "money", "money", "money", "percent", "money"],
  );
  const transactions = s.transactions
    .filter((t) => inRange(t.date))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  add(
    "movements",
    "MOVIMIENTOS DEL INTERVALO · datos registrados",
    [
      "Fecha",
      "Tipo",
      "Cuenta",
      "Medio de pago",
      "Categoría",
      "Ingresos CLP",
      "Gastos CLP",
      "Neto CLP",
      "Mes",
      "Año",
      "Origen",
      "Nota",
    ],
    transactions.map((t) => [
      t.date,
      t.type === "income" ? "Ingreso" : "Gasto",
      account(t.accountId),
      accountTypeLabel(s.accounts.find((a) => a.id === t.accountId)!),
      category(t.categoryId),
      t.type === "income" ? t.amount : 0,
      t.type === "expense" ? t.amount : 0,
      t.type === "income" ? t.amount : -t.amount,
      t.date.slice(0, 7),
      Number(t.date.slice(0, 4)),
      t.id.startsWith("installment-settle:")
        ? "Prepago"
        : t.id.startsWith("recurring:")
          ? "Recurrente / cuota"
          : "Manual",
      t.note,
    ]),
    [
      "date",
      "text",
      "text",
      "text",
      "text",
      "money",
      "money",
      "money",
      "text",
      "integer",
      "text",
      "text",
    ],
  );
  const totalsRow = cursor - 2;
  merged(totalsRow, 1, 5, "TOTAL DEL INTERVALO", 24);
  put(totalsRow, 6, stats.income, 23);
  put(totalsRow, 7, stats.expense, 23);
  put(totalsRow, 8, stats.net, 23);
  rowHeight(totalsRow, 25);
  add(
    "transfers",
    "TRANSFERENCIAS HISTÓRICAS DEL INTERVALO · no son gastos",
    ["Fecha", "Origen", "Destino", "Monto CLP"],
    s.transfers
      .filter((t) => inRange(t.date))
      .map((t) => [t.date, account(t.fromId), account(t.toId), t.amount]),
    ["date", "text", "text", "money"],
  );
  add(
    "incomeCategories",
    "INGRESOS POR CATEGORÍA",
    ["Categoría", "Intervalo CLP", "Mes CLP", "Año CLP"],
    s.categories
      .filter((c) => c.type === "income")
      .map((c) => [
        c.name,
        sum("income", from, to, c.id),
        sum("income", monthStart, to, c.id),
        sum("income", yearStart, to, c.id),
      ]),
    ["text", "money", "money", "money"],
  );
  add(
    "agenda",
    "AGENDA DEL INTERVALO · horario local del teléfono",
    [
      "Evento",
      "Inicio",
      "Hora inicio",
      "Fin",
      "Hora fin",
      "Locación",
      "Descripción",
      "Día anterior",
      "Mismo día",
    ],
    s.events
      .filter((e) => e.startsAt <= to + "T23:59" && e.endsAt > from + "T00:00")
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((e) => [
        e.title,
        e.startsAt.slice(0, 10),
        e.startsAt.slice(11),
        e.endsAt.slice(0, 10),
        e.endsAt.slice(11),
        e.location,
        e.description,
        e.remindDayBefore ? "Sí" : "No",
        e.remindSameDay ? "Sí" : "No",
      ]),
    ["text", "date", "text", "date", "text", "text", "text", "text", "text"],
  );
  merged(
    cursor,
    1,
    12,
    "Agendapp · Informe de consulta. Los movimientos y acumulados se limitan a sus fechas indicadas; los planes conservan su configuración actual. Las cuotas pendientes no son gasto duplicado.",
    19,
  );
  rowHeight(cursor, 28);
  const printEnd = cursor + 1;
  const positive = categories.filter((c) => c.interval > 0),
    top = positive
      .slice(0, 7)
      .map((c) => ({ name: c.name, value: c.interval }));
  if (positive.length > 7)
    top.push({
      name: "Otras categorías",
      value: positive.slice(7).reduce((n, c) => n + c.interval, 0),
    });
  if (!top.length) top.push({ name: "Sin gastos", value: 0 });
  const sourceStart = cursor + 4;
  top.forEach((c, i) => {
    put(sourceStart + i, 1, c.name);
    put(sourceStart + i, 2, c.value);
    rows[sourceStart + i - 1] = { hidden: true };
  });
  const ref = (c: number, start: number, end: number) =>
    `'${REPORT_SHEET}'!$${XLSX.utils.encode_col(c - 1)}$${start}:$${XLSX.utils.encode_col(c - 1)}$${end}`;
  const included = Number(to.slice(5, 7));
  const charts: ReportChart[] = [
    {
      kind: "bar",
      title: `Ingresos y gastos · ${year} al ${day(to)}`,
      startCol: 0,
      endCol: 6,
      startRow: 15,
      endRow: 30,
      labels: months.slice(0, included).map((m) => String(m[0])),
      labelRange: ref(1, annual.firstRow, annual.firstRow + included - 1),
      series: [
        {
          name: "Ingresos",
          values: months.slice(0, included).map((m) => Number(m[1])),
          range: ref(2, annual.firstRow, annual.firstRow + included - 1),
          color: "37A077",
        },
        {
          name: "Gastos",
          values: months.slice(0, included).map((m) => Number(m[2])),
          range: ref(3, annual.firstRow, annual.firstRow + included - 1),
          color: "7842D6",
        },
      ],
    },
    {
      kind: "doughnut",
      title: "¿En qué gastaste? · intervalo",
      startCol: 6,
      endCol: 12,
      startRow: 15,
      endRow: 30,
      labels: top.map((c) => c.name),
      labelRange: ref(1, sourceStart, sourceStart + top.length - 1),
      series: [
        {
          name: "Gastos",
          values: top.map((c) => c.value),
          range: ref(2, sourceStart, sourceStart + top.length - 1),
          color: "7842D6",
        },
      ],
    },
  ];
  jumpCells.forEach((j) => {
    sheet[XLSX.utils.encode_cell({ r: 3, c: j.c - 1 })].l = {
      Target: `#'${REPORT_SHEET}'!A${sections[j.key].titleRow}`,
      Tooltip: j.label,
    };
  });
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: maxRow - 1, c: 11 },
  });
  sheet["!merges"] = merges;
  sheet["!rows"] = rows;
  sheet["!cols"] = [16, 14, 22, 18, 20, 17, 18, 14, 14, 16, 18, 34].map(
    (wch) => ({ wch }),
  );
  const wb = XLSX.utils.book_new() as ReportWorkbook;
  XLSX.utils.book_append_sheet(wb, sheet, REPORT_SHEET);
  wb.Props = {
    Title: "Agendapp · Informe financiero",
    Author: "Agendapp",
    Subject: `${from} al ${to}`,
    Comments: "Datos de consulta, sin macros ni enlaces externos.",
  };
  wb.report = { styles, sections, charts, stats, printEnd };
  return wb;
}
