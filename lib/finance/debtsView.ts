/**
 * Pure client-side filter + sort for the debts list (N2). No I/O — operates on the
 * already-loaded debts so search-as-you-type / filter / sort stay instant. Kept separate
 * from the component so the logic is unit-testable.
 */
import type { Debt, DebtType } from "./types";

export type DebtSort = "balance_desc" | "apr_desc" | "due_asc" | "name_asc";

export const DEBT_SORTS: readonly { value: DebtSort; label: string }[] = [
  { value: "balance_desc", label: "Balance (high → low)" },
  { value: "apr_desc", label: "Interest (high → low)" },
  { value: "due_asc", label: "Due date (soonest)" },
  { value: "name_asc", label: "Name (A → Z)" },
] as const;

export interface DebtViewOptions {
  query: string;
  type: DebtType | "all";
  sort: DebtSort;
}

/** Lexically-sortable due key: real ISO dates sort chronologically; day-only debts come
 * after dated ones; debts with neither sort last. */
function dueKey(d: Debt): string {
  if (d.next_due_date) return `0:${d.next_due_date}`;
  if (d.due_day != null) return `1:${String(d.due_day).padStart(2, "0")}`;
  return "2:";
}

export function filterAndSortDebts(debts: Debt[], opts: DebtViewOptions): Debt[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = debts.filter((d) => {
    if (opts.type !== "all" && d.type !== opts.type) return false;
    if (q === "") return true;
    const haystack = `${d.name} ${d.issuer ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });

  // Copy before sorting (don't mutate the input); JS sort is stable, so ties keep input order.
  const sorted = [...filtered];
  switch (opts.sort) {
    case "balance_desc":
      sorted.sort((a, b) => Number(b.balance) - Number(a.balance));
      break;
    case "apr_desc":
      sorted.sort((a, b) => Number(b.apr) - Number(a.apr));
      break;
    case "due_asc":
      sorted.sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
      break;
    case "name_asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}
