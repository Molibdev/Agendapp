import { writeFileSync } from "node:fs";
import {
  apply,
  initialState,
  processRecurring,
  type State,
  type Command,
} from "../src/domain/finance";
import { makeBackup, readBackup } from "../src/domain/backup";
import { createExcelFile } from "../src/domain/excel";
const AS_OF = "2026-11-05";
let state: State = structuredClone(initialState);
const run = (command: Command) => {
  state = apply(state, command);
};
for (const account of [
  {
    id: "demo-checking",
    name: "Corriente principal · DEMO",
    type: "bank" as const,
    bank: "Banco de prueba",
    bankType: "checking" as const,
    maintenanceFee: 3500,
    openingBalance: 500000,
    active: true,
  },
  {
    id: "demo-sight",
    name: "Cuenta vista · DEMO",
    type: "bank" as const,
    bank: "Banco de prueba",
    bankType: "sight" as const,
    maintenanceFee: 0,
    openingBalance: 900000,
    active: true,
  },
  {
    id: "demo-cash",
    name: "Efectivo · DEMO",
    type: "cash" as const,
    openingBalance: 350000,
    active: true,
  },
  {
    id: "demo-card",
    name: "Tarjeta · DEMO",
    type: "credit" as const,
    bank: "Emisor de prueba",
    maintenanceFee: 2500,
    creditLimit: 2200000,
    billingDay: 15,
    openingBalance: -120000,
    active: true,
  },
])
  run({ kind: "account", value: account });
for (const c of [
  { id: "demo-education", name: "Educación", type: "expense" as const },
  { id: "demo-pets", name: "Mascotas", type: "expense" as const },
])
  run({ kind: "category", value: c });
function rule(
  id: string,
  note: string,
  amount: number,
  startDate: string,
  categoryId = "home",
  accountId = "demo-checking",
  installments?: { principal: number; interest: number; count: number },
) {
  run({
    kind: "recurring",
    value: {
      id,
      note,
      amount,
      startDate,
      nextDate: startDate,
      categoryId,
      accountId,
      type: installments ? "installment" : "expense",
      active: true,
      ...(installments
        ? { installments: { ...installments, paid: 0, paidAmount: 0 } }
        : {}),
    },
  });
}
rule("demo-internet", "Internet mensual · DEMO", 24990, "2026-01-15");
rule(
  "demo-music",
  "Suscripción en pausa · DEMO",
  5990,
  "2026-01-20",
  "leisure",
);
rule("demo-gym", "Gimnasio retirado · DEMO", 18000, "2026-02-01", "health");
rule(
  "demo-laptop",
  "Computador en 6 cuotas · DEMO",
  600000,
  "2026-08-15",
  "demo-education",
  "demo-card",
  { principal: 600000, interest: 60000, count: 6 },
);
rule(
  "demo-tv",
  "Televisor pagado · DEMO",
  210000,
  "2026-05-31",
  "leisure",
  "demo-card",
  { principal: 210000, interest: 0, count: 3 },
);
rule(
  "demo-fridge",
  "Refrigerador prepagado y retirado · DEMO",
  420000,
  "2026-06-10",
  "home",
  "demo-card",
  { principal: 420000, interest: 48000, count: 12 },
);
state = processRecurring(state, "2026-05-20");
run({ kind: "toggle-recurring", id: "demo-music" });
run({ kind: "delete-recurring", id: "demo-gym" });
state = processRecurring(state, "2026-08-20");
run({ kind: "settle-installments", id: "demo-fridge", date: "2026-08-20" });
run({ kind: "delete-recurring", id: "demo-fridge" });
state = processRecurring(state, AS_OF);
function transaction(
  id: string,
  type: "expense" | "income",
  accountId: string,
  categoryId: string,
  amount: number,
  date: string,
  note: string,
) {
  run({
    kind: "transaction",
    value: { id, type, accountId, categoryId, amount, date, note },
  });
}
for (let m = 1; m <= 11; m++) {
  const mm = String(m).padStart(2, "0"),
    d = `2026-${mm}`;
  transaction(
    `demo-salary-${mm}`,
    "income",
    "demo-checking",
    "salary",
    1600000 + m * 5000,
    `${d}-01`,
    `Sueldo ${mm} · DEMO`,
  );
  transaction(
    `demo-rent-${mm}`,
    "expense",
    "demo-checking",
    "home",
    650000,
    `${d}-02`,
    `Arriendo ${mm} · DEMO`,
  );
  transaction(
    `demo-food-${mm}`,
    "expense",
    "demo-checking",
    "food",
    110000 + m * 1700,
    `${d}-03`,
    `Supermercado ${mm} · DEMO`,
  );
  transaction(
    `demo-transit-${mm}`,
    "expense",
    "demo-sight",
    "transport",
    24000 + m * 400,
    `${d}-04`,
    `Transporte ${mm} · DEMO`,
  );
  transaction(
    `demo-leisure-${mm}`,
    "expense",
    "demo-cash",
    "leisure",
    8500 + m * 150,
    `${d}-05`,
    `Café y paseo ${mm} · DEMO`,
  );
}
transaction(
  "demo-last-year",
  "income",
  "demo-checking",
  "other-income",
  180000,
  "2025-12-29",
  "Ingreso del año anterior · DEMO",
);
transaction(
  "demo-extra",
  "income",
  "demo-checking",
  "other-income",
  125000,
  "2026-11-04",
  "Trabajo adicional · DEMO",
);
transaction(
  "demo-course",
  "expense",
  "demo-checking",
  "demo-education",
  85000,
  "2026-11-04",
  "Curso con presupuesto superado · DEMO",
);
transaction(
  "demo-pet",
  "expense",
  "demo-cash",
  "demo-pets",
  21000,
  "2026-11-05",
  "Veterinaria · DEMO",
);
transaction(
  "demo-future",
  "expense",
  "demo-card",
  "leisure",
  18000,
  "2026-12-03",
  "Compra futura: fuera del corte noviembre · DEMO",
);
run({
  kind: "transfer",
  value: {
    id: "demo-transfer",
    fromId: "demo-checking",
    toId: "demo-cash",
    amount: 100000,
    date: "2026-11-03",
  },
});
for (const b of [
  { categoryId: "food", amount: 180000 },
  { categoryId: "home", amount: 800000 },
  { categoryId: "transport", amount: 60000 },
  { categoryId: "leisure", amount: 80000 },
  { categoryId: "demo-education", amount: 60000 },
  { categoryId: "demo-pets", amount: 40000 },
])
  run({
    kind: "budget",
    value: { id: `demo-budget-${b.categoryId}`, month: "2026-11", ...b },
  });
run({
  kind: "budget",
  value: {
    id: "demo-budget-food-oct",
    month: "2026-10",
    categoryId: "food",
    amount: 170000,
  },
});
run({
  kind: "goal",
  value: {
    id: "demo-emergency",
    name: "Fondo de emergencia · DEMO",
    accountId: "demo-sight",
    target: 1000000,
  },
});
run({
  kind: "goal",
  value: {
    id: "demo-holiday",
    name: "Vacaciones · DEMO",
    accountId: "demo-checking",
    target: 500000,
  },
});
run({
  kind: "contribution",
  value: {
    id: "demo-emergency-1",
    goalId: "demo-emergency",
    amount: 200000,
    date: "2026-09-05",
  },
});
run({
  kind: "contribution",
  value: {
    id: "demo-emergency-2",
    goalId: "demo-emergency",
    amount: 100000,
    date: "2026-11-04",
  },
});
run({
  kind: "contribution",
  value: {
    id: "demo-holiday-1",
    goalId: "demo-holiday",
    amount: 150000,
    date: "2026-10-20",
  },
});
for (const e of [
  {
    id: "demo-event-past",
    title: "Revisión de octubre · DEMO",
    startsAt: "2026-10-28T19:00",
    endsAt: "2026-10-28T19:45",
    location: "Casa",
    description: "Evento pasado de ejemplo.",
    remindDayBefore: false,
    remindSameDay: false,
  },
  {
    id: "demo-event-budget",
    title: "Revisar presupuesto · DEMO",
    startsAt: "2026-11-06T18:30",
    endsAt: "2026-11-06T19:15",
    location: "Casa",
    description: "Comparar el informe Excel con gastos y cuotas.",
    remindDayBefore: true,
    remindSameDay: true,
  },
  {
    id: "demo-event-bank",
    title: "Trámite bancario · DEMO",
    startsAt: "2026-11-07T09:00",
    endsAt: "2026-11-07T10:00",
    location: "Sucursal de prueba",
    description: "Evento que se superpone parcialmente con otro.",
    remindDayBefore: true,
    remindSameDay: false,
  },
  {
    id: "demo-event-overlap",
    title: "Llamada de coordinación · DEMO",
    startsAt: "2026-11-07T09:30",
    endsAt: "2026-11-07T10:30",
    location: "En línea",
    description: "Prueba de horarios simultáneos.",
    remindDayBefore: false,
    remindSameDay: true,
  },
  {
    id: "demo-event-trip",
    title: "Viaje de varios días · DEMO",
    startsAt: "2026-11-10T18:00",
    endsAt: "2026-11-12T09:00",
    location: "Destino de prueba",
    description: "Prueba de eventos que cruzan días.",
    remindDayBefore: true,
    remindSameDay: true,
  },
])
  run({ kind: "event", value: e });
const parsed = JSON.parse(makeBackup(state));
parsed.createdAt = AS_OF + "T15:00:00.000Z";
const text = JSON.stringify(parsed, null, 2) + "\n";
const restored = readBackup(text);
const file = "examples/agendapp-datos-prueba-v0.12.0.json";
writeFileSync(file, text);
if (process.argv.includes("--excel")) {
  const file = createExcelFile(restored, "2026-11-01", AS_OF);
  writeFileSync("/tmp/Agendapp-informe-demostracion-0.12.0.xlsx", file.bytes);
  console.log(`Excel de demostración: ${file.bytes.length} bytes`);
}
console.log(
  `${file}: ${restored.transactions.length} movimientos, ${restored.recurring.length} reglas, ${restored.events.length} eventos.`,
);
