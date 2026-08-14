import { describe, it, expect } from "vitest";
import { statCellClass } from "@/lib/stat-grid";

// The Projects stats row renders 4 numbers in a 2-col (sm/md) → 4-col (lg)
// grid. The divider borders and left-padding that keep each number clear of
// its divider line have regressed before; these assertions pin the exact
// spacing classes per cell so a silent change fails loudly.
describe("statCellClass (4-stat Projects grid)", () => {
  const TOTAL = 4;

  it("cell 0 — top-left: right border, no left padding", () => {
    expect(statCellClass(0, TOTAL)).toBe("py-8 pr-6 border-white/10 border-r");
  });

  it("cell 1 — right column at 2-col: left padding clears the divider", () => {
    expect(statCellClass(1, TOTAL)).toBe(
      "py-8 pr-6 border-white/10 lg:border-r pl-6 lg:pl-8",
    );
  });

  it("cell 2 — left at 2-col but right-of-divider at 4-col: border + lg padding", () => {
    expect(statCellClass(2, TOTAL)).toBe(
      "py-8 pr-6 border-white/10 border-r lg:pl-8",
    );
  });

  it("cell 3 — last cell: never carries a trailing right border", () => {
    const cls = statCellClass(3, TOTAL);
    expect(cls).toBe("py-8 pr-6 border-white/10 pl-6 lg:pl-8");
    // Regression guard: the rightmost cell must not draw a divider off its edge.
    expect(cls).not.toMatch(/(^|\s)border-r(\s|$)/);
  });

  it("every right-column cell has left padding so text never collides with its divider", () => {
    // Odd indices are the right column at the 2-col breakpoint.
    for (const i of [1, 3]) {
      expect(statCellClass(i, TOTAL)).toContain("pl-6");
    }
  });

  it("shares a consistent base (vertical padding + border color) on every cell", () => {
    for (let i = 0; i < TOTAL; i++) {
      expect(statCellClass(i, TOTAL)).toContain("py-8 pr-6 border-white/10");
    }
  });
});
