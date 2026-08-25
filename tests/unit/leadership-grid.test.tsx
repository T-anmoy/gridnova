import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import LeadershipPreview from "@/components/LeadershipPreview";

// The home leadership preview once rendered a 2-column grid on mobile, which
// left an orphaned empty cell next to the 5th member. It must render a single
// column on mobile — a layout that structurally cannot orphan a slot at any
// team size.
describe("LeadershipPreview grid", () => {
  it("is single-column on mobile (grid-cols-1), never the 2-col that orphaned a slot", () => {
    const { container } = render(<LeadershipPreview />);
    const grid = container.querySelector("div.grid");
    expect(grid).not.toBeNull();
    expect(grid!.className).toContain("grid-cols-1");
    expect(grid!.className).not.toContain("grid-cols-2");
  });

  it("renders exactly one card per leader — no empty/filler slots", () => {
    const { container } = render(<LeadershipPreview />);
    const grid = container.querySelector("div.grid")!;
    const cards = Array.from(grid.children);
    // 7 leaders in the data → 7 cards, and every card has visible content.
    // (Updated from 6 when Naren Mukherjee was added as Senior Advisor — Solar Power.)
    expect(cards.length).toBe(7);
    for (const card of cards) {
      expect((card.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});
