import { describe, it, expect } from "vitest";
import { monthOptions, summarizeHistory, type HistoryItem } from "@/lib/finance/history";

describe("monthOptions", () => {
  it("lists the anchor month + prior months, newest first, as billing-month values + labels", () => {
    // June 2026 (month index 5), 3 months back.
    expect(monthOptions(2026, 5, 3)).toEqual([
      { value: "2026-06-01", label: "June 2026" },
      { value: "2026-05-01", label: "May 2026" },
      { value: "2026-04-01", label: "April 2026" },
    ]);
  });

  it("crosses the year boundary correctly", () => {
    expect(monthOptions(2026, 0, 2)).toEqual([
      { value: "2026-01-01", label: "January 2026" },
      { value: "2025-12-01", label: "December 2025" },
    ]);
  });
});

describe("summarizeHistory", () => {
  const items: HistoryItem[] = [
    { id: "a", name: "Internet", kind: "payment", amount: 110.5 },
    { id: "b", name: "Emergency", kind: "contribution", amount: 200 },
  ];
  it("totals the amounts and counts the items", () => {
    expect(summarizeHistory(items)).toEqual({ total: 310.5, count: 2 });
  });
  it("is zero/empty for no items", () => {
    expect(summarizeHistory([])).toEqual({ total: 0, count: 0 });
  });
});
