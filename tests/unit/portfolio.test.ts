import { describe, it, expect } from "vitest";
import {
  serializePortfolio,
  parsePortfolio,
  pickColumns,
  remapId,
  PORTFOLIO_VERSION,
  type PortfolioData,
} from "@/lib/finance/portfolio";

const empty: PortfolioData = { debts: [], incomes: [], expenses: [], savings_goals: [], transactions: [] };

describe("serializePortfolio / parsePortfolio round-trip", () => {
  it("serializes with version + exportedAt and parses back", () => {
    const json = serializePortfolio({ ...empty, debts: [{ name: "Citi" }] }, "2026-06-04T00:00:00Z");
    const r = parsePortfolio(json);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc.version).toBe(PORTFOLIO_VERSION);
      expect(r.doc.exportedAt).toBe("2026-06-04T00:00:00Z");
      expect(r.doc.data.debts).toEqual([{ name: "Citi" }]);
    }
  });
});

describe("parsePortfolio validation", () => {
  it("rejects non-JSON", () => {
    expect(parsePortfolio("not json").ok).toBe(false);
  });
  it("rejects a newer version", () => {
    expect(parsePortfolio(JSON.stringify({ version: 999, data: empty })).ok).toBe(false);
  });
  it("rejects a missing table section", () => {
    const bad = JSON.stringify({ version: 1, data: { debts: [], incomes: [], expenses: [], savings_goals: [] } });
    const r = parsePortfolio(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/transactions/);
  });
  it("accepts a well-formed empty backup", () => {
    expect(parsePortfolio(JSON.stringify({ version: 1, data: empty })).ok).toBe(true);
  });
});

describe("pickColumns — security allow-list", () => {
  it("keeps known columns and drops id / profile_id / unknown fields", () => {
    const row = {
      id: "old-id",
      profile_id: "someone-else",
      name: "Citi",
      balance: 1000,
      created_at: "x",
      hacked_column: "DROP TABLE",
    };
    expect(pickColumns(row, "debts")).toEqual({ name: "Citi", balance: 1000 });
  });

  it("keeps FK columns for tables that declare them (expenses)", () => {
    // debt_id is remapped by the action, not copied here — expenses' allow-list excludes it,
    // so the action sets it explicitly after remap.
    expect(pickColumns({ category: "Internet", debt_id: "x" }, "expenses")).toEqual({ category: "Internet" });
  });
});

describe("remapId", () => {
  const map = new Map([["old", "new"]]);
  it("maps a known id, nulls unknown/blank/non-string", () => {
    expect(remapId(map, "old")).toBe("new");
    expect(remapId(map, "missing")).toBe(null);
    expect(remapId(map, "")).toBe(null);
    expect(remapId(map, null)).toBe(null);
    expect(remapId(map, 42)).toBe(null);
  });
});
