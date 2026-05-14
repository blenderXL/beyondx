import { describe, it, expect } from "vitest";
import { freeEntitlements } from "@/lib/entitlements/getEntitlements";

describe("entitlements", () => {
  it("freeEntitlements returns the no-Pro shape", () => {
    const e = freeEntitlements();
    expect(e.tier).toBe("free");
    expect(e.assistantMessagesRemaining).toBe(0);
    expect(e.features.advancedCharts).toBe(false);
    expect(e.features.assistant).toBe(false);
    expect(e.features.exportPdf).toBe(false);
  });
});
