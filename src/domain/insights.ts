import type { State } from "./finance";
/** Recorded expenses only. Transfers and future estimates are never synthesized. */
export function spendingSeries(state: State, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mes inválido");
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const daily = Array<number>(days).fill(0);
  const entries = state.transactions.filter(
    (t) => t.type === "expense" && t.date.startsWith(month + "-"),
  );
  for (const entry of entries)
    daily[Number(entry.date.slice(8)) - 1] += entry.amount;
  let total = 0;
  const points = daily.map((amount, i) => ({
    day: i + 1,
    amount,
    cumulative: (total += amount),
  }));
  return { points, total, count: entries.length, days };
}
