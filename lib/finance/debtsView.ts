/**
 * Pure client-side filter + sort for the debts list (N2). No I/O — operates on the
 * already-loaded debts so search-as-you-type / filter / sort stay instant. Kept separate
 * from the component so the logic is unit-testable.
 */
import type { Debt, DebtType } from "./types";

export type DebtSort =
  | "balance_desc"
  | "balance_asc"
  | "apr_desc"
  | "apr_asc"
  | "due_asc"
  | "due_desc"
  | "name_asc"
  | "name_desc";

export const DEBT_SORTS: readonly { value: DebtSort; label: string }[] = [
  { value: "balance_desc", label: "Balance (high → low)" },
  { value: "balance_asc", label: "Balance (low → high)" },
  { value: "apr_desc", label: "Interest (high → low)" },
  { value: "apr_asc", label: "Interest (low → high)" },
  { value: "due_asc", label: "Due date (soonest)" },
  { value: "due_desc", label: "Due date (latest)" },
  { value: "name_asc", label: "Name (A → Z)" },
  { value: "name_desc", label: "Name (Z → A)" },
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
    case "balance_asc":
      sorted.sort((a, b) => Number(a.balance) - Number(b.balance));
      break;
    case "apr_desc":
      sorted.sort((a, b) => Number(b.apr) - Number(a.apr));
      break;
    case "apr_asc":
      sorted.sort((a, b) => Number(a.apr) - Number(b.apr));
      break;
    case "due_asc":
      sorted.sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
      break;
    case "due_desc":
      sorted.sort((a, b) => dueKey(b).localeCompare(dueKey(a)));
      break;
    case "name_asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name_desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }
  // Paid-off debts (zero balance) sink to the bottom of every view; the chosen sort still
  // holds within the active and paid-off partitions.
  const active = sorted.filter((d) => Number(d.balance) > 0);
  const paidOff = sorted.filter((d) => Number(d.balance) <= 0);
  return [...active, ...paidOff];
}
