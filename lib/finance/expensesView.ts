/**
 * Pure client-side filter + sort for the expenses list (Phase 5A). No I/O — operates on the
 * already-loaded expenses so search-as-you-type / filter / sort stay instant. Mirrors
 * `debtsView.ts` and is kept separate from the component so the logic is unit-testable.
 */
import type { Card, Expense, ExpenseGroup } from "./types";
import { expenseDisplayAmount } from "./derive";

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

/**
 * Stable partition: unpaid items first, paid items last, preserving the incoming order within
 * each partition. Lets the chosen sort hold while settled bills sink to the bottom of any view.
 */
export function partitionPaidLast<T extends { id: string }>(items: T[], paid: Set<string>): T[] {
  const unpaid = items.filter((e) => !paid.has(e.id));
  const done = items.filter((e) => paid.has(e.id));
  return [...unpaid, ...done];
}

/** Per-card rollup for the Expenses rail. `cardId: null` is the "unassigned" bucket. */
export interface CardSummary {
  cardId: string | null;
  planned: number;
  paid: number;
  count: number;
}

/**
 * Roll the month's expenses up by the card they're tagged with (migration 0021). `planned`
 * sums each expense's display amount (percent offerings resolved against `income`, same figure
 * the list shows); `paid` sums only the ones checked off this month. Every active card appears
 * (even at $0, so a freshly-added card is visible); an expense whose `card_id` points at an
 * archived/unknown card — or none — falls into the trailing "unassigned" bucket, which is
 * omitted when empty. Pure + unit-tested.
 */
/** A debt payment as a card-taggable bill: its planned amount is the monthly minimum. */
export interface CardDebtBill {
  id: string;
  card_id?: string | null;
  amount: number;
}

export function summarizeByCard(
  expenses: Expense[],
  cards: Card[],
  income: number,
  paidExpenseIds: Set<string>,
  debtBills: CardDebtBill[] = [],
  paidDebtIds: Set<string> = new Set(),
): CardSummary[] {
  const empty = (cardId: string | null): CardSummary => ({ cardId, planned: 0, paid: 0, count: 0 });
  const byCard = new Map<string | null, CardSummary>();
  for (const c of cards) byCard.set(c.id, empty(c.id));
  const unassigned = empty(null);

  for (const e of expenses) {
    const bucket = e.card_id && byCard.has(e.card_id) ? byCard.get(e.card_id)! : unassigned;
    const amount = expenseDisplayAmount(e, income);
    bucket.planned += amount;
    bucket.count += 1;
    if (paidExpenseIds.has(e.id)) bucket.paid += amount;
  }

  // Debt payments tagged to a card roll into the same totals (migration 0022).
  for (const d of debtBills) {
    const bucket = d.card_id && byCard.has(d.card_id) ? byCard.get(d.card_id)! : unassigned;
    bucket.planned += d.amount;
    bucket.count += 1;
    if (paidDebtIds.has(d.id)) bucket.paid += d.amount;
  }

  const rounded = (s: CardSummary): CardSummary => ({
    ...s,
    planned: Math.round((s.planned + Number.EPSILON) * 100) / 100,
    paid: Math.round((s.paid + Number.EPSILON) * 100) / 100,
  });

  const result = cards.map((c) => rounded(byCard.get(c.id)!));
  if (unassigned.count > 0) result.push(rounded(unassigned));
  return result;
}
