import { describe, it, expect } from "vitest";
import { DEBT_TYPE_ICONS } from "@/components/finance/DebtTypeIcon";
import { DEBT_TYPES } from "@/lib/finance/types";

describe("DEBT_TYPE_ICONS", () => {
  it("has exactly one icon for every debt type", () => {
    for (const type of DEBT_TYPES) {
      expect(DEBT_TYPE_ICONS[type]).toBeTruthy();
    }
    expect(Object.keys(DEBT_TYPE_ICONS).sort()).toEqual([...DEBT_TYPES].sort());
  });
});
