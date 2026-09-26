import { describe, it, expect } from "vitest";
import { STATES, DISCOMS, DISCOMS_BY_STATE, discomsForState } from "@/app/(internal)/proposal/new/types";
import { discomsForState as calculatorDiscomsForState } from "@/app/(site)/[lang]/solar-calculator/lib";

describe("STATES — full India coverage", () => {
  it("includes all 28 states + 8 union territories (36 total), no duplicates", () => {
    expect(STATES).toHaveLength(36);
    expect(new Set(STATES).size).toBe(STATES.length);
  });

  it("no longer contains the old placeholder catch-all", () => {
    expect(STATES).not.toContain("Other Eastern State (feasibility required)");
  });

  it("includes real states and union territories the old list didn't have", () => {
    for (const s of ["Karnataka", "Maharashtra", "Tamil Nadu", "Delhi", "Ladakh", "Puducherry"]) {
      expect(STATES).toContain(s);
    }
  });
});

describe("DISCOMS_BY_STATE — real per-state coverage", () => {
  it("has an entry for every state and UT, each with at least one DISCOM", () => {
    for (const state of STATES) {
      const discoms = DISCOMS_BY_STATE[state];
      expect(discoms, `missing DISCOM entry for ${state}`).toBeDefined();
      expect(discoms.length).toBeGreaterThan(0);
    }
  });

  it("lists all regional DISCOMs for a real multi-DISCOM state (Bihar)", () => {
    expect(discomsForState("Bihar")).toEqual(["NBPDCL (North Bihar)", "SBPDCL (South Bihar)"]);
  });

  it("keeps West Bengal's existing values intact (WBSEDCL unqualified, matching prior test expectations)", () => {
    expect(discomsForState("West Bengal")).toContain("WBSEDCL");
  });

  it("reflects Odisha's real 2021 privatization to Tata Power distribution companies, not a generic state board", () => {
    const odisha = discomsForState("Odisha");
    expect(odisha.some((d) => d.startsWith("TP"))).toBe(true);
  });

  it("uses a single department entry for a state with no corporatized DISCOM brand", () => {
    expect(discomsForState("Sikkim")).toEqual(["Sikkim Energy & Power Department"]);
  });

  it("returns an empty list for an unknown/unselected state rather than throwing", () => {
    expect(discomsForState("")).toEqual([]);
    expect(discomsForState("Narnia")).toEqual([]);
  });

  it("DISCOMS (flat fallback) contains every DISCOM referenced in DISCOMS_BY_STATE, deduplicated", () => {
    const allGrouped = new Set(Object.values(DISCOMS_BY_STATE).flat());
    expect(new Set(DISCOMS)).toEqual(allGrouped);
    expect(DISCOMS.length).toBe(new Set(DISCOMS).size);
  });
});

describe("shared source — Solar Calculator and proposal wizard use the same data, not a second list", () => {
  it("the calculator's discomsForState is the exact same function as the proposal wizard's, re-exported not duplicated", () => {
    expect(calculatorDiscomsForState).toBe(discomsForState);
  });
});
