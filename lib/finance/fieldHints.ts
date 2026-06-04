/**
 * Short, plain-language descriptions shown by `<FieldHint>` next to form-field labels.
 * Centralized so the copy stays consistent and is edited in one place. Keep each hint
 * to a sentence or two — these are quick clarifications, not documentation.
 */
export const DEBT_HINTS = {
  name: "A short label so you can recognize this account.",
  type: "The kind of debt — the form's fields adapt to your choice.",
  balance: "What you owe right now. Your first entry is saved as the starting baseline for progress.",
  min_payment: "The smallest payment due each period.",
  apr: "Annual interest rate. You can type the % sign.",
  credit_limit: "Your card's limit — used to show credit utilization.",
  next_due_date: "When the next payment is due.",
  issuer: "The bank or lender (e.g. Chase, Capital One).",
  promo: "A temporary intro rate. Turn this on to enter the promo rate, its end date, and whether interest is deferred.",
} as const;

export const EXPENSE_HINTS = {
  category: "What this expense is (e.g. Internet, Electricity, HOA).",
  group: "A rollup bucket so the planner can total similar expenses together.",
  payee: "Who you pay (e.g. Optimum, CoServ). Optional.",
  amount: "How much this expense is, per the frequency you choose. The $ sign is fine.",
  cadence: "How often it recurs.",
  pay_day: "The day this month you plan to pay it.",
  debt_id: "Link this to a debt to have paying it (in the Budget) draw down that debt's balance.",
} as const;

export const INCOME_HINTS = {
  source: "A label for this paycheck or income stream.",
  amount: "How much you receive, per the frequency below. The $ sign is fine.",
  cadence: "How often you're paid.",
  pay_day: "The day of the month it lands (e.g. 1 or 15) — used to split the plan by pay cycle.",
  tithe_mode: "Set aside a percentage or a fixed amount as an offering/tithe.",
  tithe_value: "The percent (if percent) or dollar amount (if fixed) to set aside.",
  is_variable: "Income that changes month to month. The amount above is your baseline; set each month's actual on the Budget page.",
} as const;

export const SAVINGS_HINTS = {
  name: "A label for this savings pot (e.g. Purge, Emergency fund).",
  current_amount: "How much is in the pot right now.",
  target_amount: "An optional goal — the bar shows progress toward it.",
} as const;

export const PLAN_HINTS = {
  method: "Avalanche pays highest-APR first (least interest); Snowball pays smallest balance first (fastest wins).",
  budget: "The total you'll put toward debt each month. Above the minimums, the extra accelerates payoff.",
} as const;
