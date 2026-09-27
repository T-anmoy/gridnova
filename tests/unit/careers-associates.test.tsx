import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import CareersPage from "@/app/(site)/[lang]/careers/page";
import { ASSOCIATE_PORTAL_OPEN, ASSOCIATE_ROUTES } from "@/lib/associates";
import { EN_PARAMS, withI18n } from "./helpers/i18n";

async function renderPage() {
  const element = await CareersPage(EN_PARAMS);
  return render(withI18n(element));
}

describe("Careers & Associates page", () => {
  it("links every Apply/Login button to its real Phase 2B route now that ASSOCIATE_PORTAL_OPEN is true", async () => {
    expect(ASSOCIATE_PORTAL_OPEN).toBe(true);
    const { container } = await renderPage();
    for (const href of Object.values(ASSOCIATE_ROUTES)) {
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
    expect(screen.queryByRole("link", { name: /opening soon/i })).toBeNull();
  });

  it("has the anchors the homepage and footer point to", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("#associates")).not.toBeNull();
    expect(container.querySelector("#careers")).not.toBeNull();
  });

  it("marks unconfirmed terms as pending instead of stating them as fact", async () => {
    const { container } = await renderPage();
    const pending = Array.from(container.querySelectorAll("mark.pending-value")).map((m) => m.firstChild?.textContent);
    expect(pending).toContain("monthly, by the 10th of the following month");
    expect(pending).toContain("90");
    expect(pending).toContain("15");
    // No raw square brackets left in the rendered text.
    expect(container.textContent).not.toMatch(/\[[^\]]+\]/);
  });

  it("labels every mock portal screen as an illustration", async () => {
    await renderPage();
    const figures = screen.getAllByRole("figure");
    expect(figures).toHaveLength(5);
    for (const f of figures) expect(within(f).getByText("Illustration")).toBeInTheDocument();
  });

  it("keeps the existing careers content, including the CV email", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: "Build the grid with us." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /email your cv/i }).getAttribute("href")).toMatch(/^mailto:careers@gridnova\.in/);
  });
});
