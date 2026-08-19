import { describe, it, expect } from "vitest";
import {
  conversionChartData,
  dealSizeChartData,
  pipelineChartData,
  weekLabel,
} from "@/lib/dashboard/analytics-transform";

describe("conversionChartData", () => {
  it("scales 0..1 rates to whole-percent numbers", () => {
    expect(
      conversionChartData([
        { source: "Web", total_leads: 100, won_leads: 25, conversion_rate: 0.25 },
        { source: "Referral", total_leads: 40, won_leads: 14, conversion_rate: 0.35 },
      ]),
    ).toEqual([
      { name: "Web", rate: 25 },
      { name: "Referral", rate: 35 },
    ]);
  });

  it("treats a null rate as 0 (never NaN)", () => {
    const out = conversionChartData([
      { source: "Cold", total_leads: 0, won_leads: 0, conversion_rate: null },
    ]);
    expect(out).toEqual([{ name: "Cold", rate: 0 }]);
  });

  it("rounds to one decimal place", () => {
    expect(
      conversionChartData([
        { source: "X", total_leads: 3, won_leads: 1, conversion_rate: 0.33333 },
      ]),
    ).toEqual([{ name: "X", rate: 33.3 }]);
  });

  it("returns [] for undefined input", () => {
    expect(conversionChartData(undefined)).toEqual([]);
  });
});

describe("dealSizeChartData", () => {
  it("maps avg and total, coercing nulls to 0", () => {
    expect(
      dealSizeChartData([
        { tier: "0-3kW", proposal_count: 10, average_value: 120000, total_value: 1200000 },
        { tier: "3-10kW", proposal_count: 2, average_value: null, total_value: null },
      ]),
    ).toEqual([
      { name: "0-3kW", avg: 120000, total: 1200000 },
      { name: "3-10kW", avg: 0, total: 0 },
    ]);
  });

  it("returns [] for undefined input", () => {
    expect(dealSizeChartData(undefined)).toEqual([]);
  });
});

describe("pipelineChartData", () => {
  it("maps leads_created/proposals_won into leads/won", () => {
    const out = pipelineChartData([
      { week_start: "not-a-date", leads_created: 12, proposals_won: 3 },
    ]);
    expect(out).toEqual([{ name: "not-a-date", leads: 12, won: 3 }]);
  });

  it("returns [] for undefined input", () => {
    expect(pipelineChartData(undefined)).toEqual([]);
  });
});

describe("weekLabel", () => {
  it("passes through non-date strings unchanged", () => {
    expect(weekLabel("W-14")).toBe("W-14");
  });

  it("formats an ISO date to a short day-month label", () => {
    // Deterministic parts check (locale formatting keeps day + month token).
    const label = weekLabel("2026-01-05");
    expect(label).toMatch(/05/);
    expect(label).toMatch(/Jan/);
  });
});
