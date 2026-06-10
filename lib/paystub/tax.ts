/**
 * A rough US paycheck estimator — federal income tax (2025 brackets), FICA, and a bundled
 * per-state flat effective income-tax rate. Pure + unit-tested. This is deliberately
 * approximate: no local/city taxes, SDI, credits, or itemizing. The UI shows a disclaimer.
 */

export type FilingStatus = "single" | "married" | "head";
export type PayType = "salary" | "hourly";
export type PayCadence = "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual";

export interface PaystubInputs {
  payType: PayType;
  /** Salary: annual gross. Hourly: dollars per hour. */
  rate: number;
  /** Hourly only. */
  hoursPerWeek: number;
  /** Pay period the per-check column is divided into. */
  cadence: PayCadence;
  /** Two-letter state code (or "" for none). */
  state: string;
  filingStatus: FilingStatus;
  /** 401(k) contribution as a % of gross (pre-tax for income tax, still FICA-taxable). */
  pretax401kPct: number;
  /** Other pre-tax deductions per month (e.g. health premiums) — reduce income tax AND FICA. */
  otherPretaxMonthly: number;
}

export interface PaystubBreakdown {
  periodsPerYear: number;
  /** All figures below are ANNUAL dollars. */
  gross: number;
  pretax401k: number;
  otherPretax: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  state: number;
  /** Take-home = gross − 401(k) − other pre-tax − all taxes. */
  net: number;
}

// 2025 figures.
const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15000,
  married: 30000,
  head: 22500,
};

type Bracket = { upTo: number; rate: number };
const FEDERAL_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 11925, rate: 0.1 },
    { upTo: 48475, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250525, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married: [
    { upTo: 23850, rate: 0.1 },
    { upTo: 96950, rate: 0.12 },
    { upTo: 206700, rate: 0.22 },
    { upTo: 394600, rate: 0.24 },
    { upTo: 501050, rate: 0.32 },
    { upTo: 751600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head: [
    { upTo: 17000, rate: 0.1 },
    { upTo: 64850, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250500, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

const SS_WAGE_BASE = 176100; // 2025
const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const ADDL_MEDICARE_RATE = 0.009;
const ADDL_MEDICARE_THRESHOLD = 200000;

const PERIODS: Record<PayCadence, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  annual: 1,
};

/** Bundled flat effective state income-tax rates (%). 0 = no wage income tax. Rough estimates. */
export const STATE_TAX_RATE: Record<string, number> = {
  AL: 4.5, AK: 0, AZ: 2.5, AR: 3.9, CA: 6.0, CO: 4.4, CT: 5.0, DE: 5.0, DC: 7.0, FL: 0,
  GA: 5.39, HI: 7.0, ID: 5.8, IL: 4.95, IN: 3.0, IA: 3.8, KS: 5.0, KY: 4.0, LA: 3.0, ME: 6.0,
  MD: 5.0, MA: 5.0, MI: 4.25, MN: 6.5, MS: 4.4, MO: 4.0, MT: 5.5, NE: 5.0, NV: 0, NH: 0,
  NJ: 5.5, NM: 4.5, NY: 6.0, NC: 4.25, ND: 2.0, OH: 3.0, OK: 4.0, OR: 8.0, PA: 3.07, RI: 4.5,
  SC: 5.0, SD: 0, TN: 0, TX: 0, UT: 4.55, VT: 6.0, VA: 5.0, WA: 0, WV: 4.5, WI: 5.0, WY: 0,
};

export const STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

export const FILING_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  married: "Married, filing jointly",
  head: "Head of household",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Progressive tax over marginal brackets. */
function progressiveTax(brackets: Bracket[], taxable: number): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (taxable <= lower) break;
    const slice = Math.min(taxable, b.upTo) - lower;
    tax += slice * b.rate;
    lower = b.upTo;
  }
  return tax;
}

/** Annual gross from the pay inputs. */
export function annualGross(input: Pick<PaystubInputs, "payType" | "rate" | "hoursPerWeek">): number {
  const rate = Math.max(0, input.rate || 0);
  if (input.payType === "hourly") return rate * Math.max(0, input.hoursPerWeek || 0) * 52;
  return rate; // salary: rate is the annual figure
}

/** The full annual estimate. Divide with `dividePaystub` for per-period / monthly columns. */
export function estimatePaystub(input: PaystubInputs): PaystubBreakdown {
  const gross = annualGross(input);
  const pretax401k = round2(gross * Math.max(0, Math.min(100, input.pretax401kPct || 0)) / 100);
  const otherPretax = round2(Math.max(0, input.otherPretaxMonthly || 0) * 12);

  // 401(k) is pre-tax for income tax but still FICA-taxable; cafeteria-plan pre-tax reduces both.
  const ficaWages = Math.max(0, gross - otherPretax);
  const socialSecurity = round2(Math.min(ficaWages, SS_WAGE_BASE) * SS_RATE);
  const medicare = round2(
    ficaWages * MEDICARE_RATE + Math.max(0, ficaWages - ADDL_MEDICARE_THRESHOLD) * ADDL_MEDICARE_RATE,
  );

  const fedTaxable = Math.max(0, gross - pretax401k - otherPretax - STANDARD_DEDUCTION[input.filingStatus]);
  const federal = round2(progressiveTax(FEDERAL_BRACKETS[input.filingStatus], fedTaxable));

  const stateRate = (STATE_TAX_RATE[input.state] ?? 0) / 100;
  const stateTaxable = Math.max(0, gross - pretax401k - otherPretax);
  const state = round2(stateTaxable * stateRate);

  const net = round2(gross - pretax401k - otherPretax - federal - socialSecurity - medicare - state);

  return {
    periodsPerYear: PERIODS[input.cadence],
    gross,
    pretax401k,
    otherPretax,
    federal,
    socialSecurity,
    medicare,
    state,
    net,
  };
}

/** Scale an annual breakdown down to a single period (e.g. periodsPerYear for one paycheck, 12 for monthly). */
export function dividePaystub(b: PaystubBreakdown, periods: number): Omit<PaystubBreakdown, "periodsPerYear"> {
  const d = (n: number) => round2(n / periods);
  return {
    gross: d(b.gross),
    pretax401k: d(b.pretax401k),
    otherPretax: d(b.otherPretax),
    federal: d(b.federal),
    socialSecurity: d(b.socialSecurity),
    medicare: d(b.medicare),
    state: d(b.state),
    net: d(b.net),
  };
}
