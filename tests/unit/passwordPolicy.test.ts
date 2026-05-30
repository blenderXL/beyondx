import { describe, it, expect } from "vitest";
import { validatePassword, passwordChecks, MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";

describe("passwordPolicy", () => {
  it("accepts a password meeting every requirement", () => {
    expect(validatePassword("Str0ng-Pass!").ok).toBe(true);
    expect(validatePassword("Str0ng-Pass!").fails).toEqual([]);
  });

  it("rejects a password under the minimum length", () => {
    const { ok, fails } = validatePassword("Ab1!xy");
    expect(ok).toBe(false);
    expect(fails).toContain(`At least ${MIN_PASSWORD_LENGTH} characters`);
  });

  it("flags each missing character class", () => {
    expect(validatePassword("alllowercase1!").fails).toContain("An uppercase letter");
    expect(validatePassword("ALLUPPERCASE1!").fails).toContain("A lowercase letter");
    expect(validatePassword("NoDigitsHere!").fails).toContain("A number");
    expect(validatePassword("NoSymbols1234").fails).toContain("A symbol");
  });

  it("passwordChecks returns one entry per rule, all ok for a strong password", () => {
    const checks = passwordChecks("Str0ng-Pass!");
    expect(checks).toHaveLength(5);
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
