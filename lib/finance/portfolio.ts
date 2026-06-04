/**
 * Portfolio export/import — a versioned JSON snapshot of a user's finance data so they can
 * back it up (and restore into a fresh account after deleting). Pure serialization +
 * validation + column allow-listing live here; the DB read/write + FK remap happen in the
 * Settings server actions. Allow-listing is a security boundary: on import we copy ONLY
 * known data columns and force `profile_id` to the current user, so a hand-edited file
 * can't set ids, ownership, or unknown columns.
 */

export const PORTFOLIO_VERSION = 1;

export type PortfolioTable = "debts" | "incomes" | "expenses" | "savings_goals" | "transactions";

/** Opaque rows — we only ever read declared columns from them. */
export type Row = Record<string, unknown>;

export interface PortfolioData {
  debts: Row[];
  incomes: Row[];
  expenses: Row[];
  savings_goals: Row[];
  transactions: Row[];
}

export interface PortfolioDoc {
  version: number;
  exportedAt: string;
  data: PortfolioData;
}

/** Data columns copied on import (id / profile_id / timestamps are intentionally excluded;
 * FK columns are listed and remapped to freshly-inserted ids by the action). */
export const PORTFOLIO_COLUMNS: Record<PortfolioTable, readonly string[]> = {
  debts: [
    "name", "type", "balance", "apr", "min_payment", "due_day", "next_due_date", "credit_limit",
    "original_balance", "issuer", "promo_apr", "promo_until", "deferred_interest", "payoff_order",
    "notes", "archived_at",
  ],
  incomes: ["source", "amount", "cadence", "tithe_mode", "tithe_value", "pay_day", "archived_at"],
  expenses: ["category", "amount", "cadence", "expense_group", "payee", "due_day", "archived_at"],
  savings_goals: ["name", "target_amount", "current_amount", "archived_at"],
  transactions: ["kind", "amount", "occurred_on", "billing_month", "note"],
} as const;

const TABLES: PortfolioTable[] = ["debts", "incomes", "expenses", "savings_goals", "transactions"];

export function serializePortfolio(data: PortfolioData, exportedAt: string): string {
  return JSON.stringify({ version: PORTFOLIO_VERSION, exportedAt, data }, null, 2);
}

/** Parse + validate an uploaded file. Returns the doc or a human message — never throws. */
export function parsePortfolio(raw: string): { ok: true; doc: PortfolioDoc } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Unrecognized backup file." };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.version !== "number" || obj.version > PORTFOLIO_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of NZX." };
  }
  const data = obj.data as Record<string, unknown> | undefined;
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Backup is missing its data." };
  }
  for (const t of TABLES) {
    if (!Array.isArray((data as Record<string, unknown>)[t])) {
      return { ok: false, error: `Backup is missing the "${t}" section.` };
    }
  }
  return {
    ok: true,
    doc: {
      version: obj.version,
      exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
      data: data as unknown as PortfolioData,
    },
  };
}

/** Copy only the allow-listed data columns from a row (drops id/profile_id/unknown fields). */
export function pickColumns(row: Row, table: PortfolioTable): Row {
  const out: Row = {};
  for (const col of PORTFOLIO_COLUMNS[table]) {
    if (row[col] !== undefined) out[col] = row[col];
  }
  return out;
}

/** Remap an old FK id to its freshly-inserted id; null when absent or not in the map. */
export function remapId(map: Map<string, string>, oldId: unknown): string | null {
  if (typeof oldId !== "string" || oldId === "") return null;
  return map.get(oldId) ?? null;
}
