/**
 * Pure client-side filter + sort for the expenses list (Phase 5A). No I/O — operates on the
 * already-loaded expenses so search-as-you-type / filter / sort stay instant. Mirrors
 * `debtsView.ts` and is kept separate from the component so the logic is unit-testable.
 */
import type { Expense, ExpenseGroup } from "./types";

export type ExpenseSort = "amount_desc" | "amount_asc" | "name_asc" | "name_desc" | "payday_asc" | "payday_desc";

export const EXPENSE_SORTS: readonly { value: ExpenseSort; label: string }[] = [
  { value: "amount_desc", label: "Amount (high → low)" },
  { value: "amount_asc", label: "Amount (low → high)" },
  { value: "payday_asc", label: "Pay day (soonest)" },
  { value: "payday_desc", label: "Pay day (latest)" },
  { value: "name_asc", label: "Name (A → Z)" },
  { value: "name_desc", label: "Name (Z → A)" },
] as const;

export interface ExpenseViewOptions {
  query: string;
  group: ExpenseGroup | "all";
  sort: ExpenseSort;
}

/** Pay-day sort key: scheduled days first (ascending), unscheduled last. */
function payKey(e: Expense): number {
  return e.due_day == null ? 99 : e.due_day;
}

export function filterAndSortExpenses(expenses: Expense[], opts: ExpenseViewOptions): Expense[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = expenses.filter((e) => {
    if (opts.group !== "all" && e.expense_group !== opts.group) return false;
    if (q === "") return true;
    const haystack = `${e.category} ${e.payee ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });

  // Copy before sorting (don't mutate the input); JS sort is stable, so ties keep input order.
  const sorted = [...filtered];
  switch (opts.sort) {
    case "amount_desc":
      sorted.sort((a, b) => Number(b.amount) - Number(a.amount));
      break;
    case "amount_asc":
      sorted.sort((a, b) => Number(a.amount) - Number(b.amount));
      break;
    case "payday_asc":
      sorted.sort((a, b) => payKey(a) - payKey(b));
      break;
    case "payday_desc":
      sorted.sort((a, b) => payKey(b) - payKey(a));
      break;
    case "name_asc":
      sorted.sort((a, b) => a.category.localeCompare(b.category));
      break;
    case "name_desc":
      sorted.sort((a, b) => b.category.localeCompare(a.category));
      break;
  }
  return sorted;
}
