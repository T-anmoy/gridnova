import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import PolicyDocument from "@/components/legal/PolicyDocument";
import {
  POLICY_SLUGS,
  getPolicy,
  ASSOCIATE_KYC_CONSENT_NOTICE,
  CUSTOMER_INFORMATION_NOTICE,
} from "@/content/policies";
import { en, withI18n } from "./helpers/i18n";

const root = path.resolve(__dirname, "../..");
const draft = readFileSync(path.resolve(root, "content/policies/GridNova_Policies_Draft_v1.md"), "utf8");

describe("policy pages", () => {
  for (const slug of POLICY_SLUGS) {
    it(`${slug}: renders every section, and shows each [bracketed] item as a pending marker, never as raw text`, () => {
      const doc = getPolicy(slug);
      const { container } = render(withI18n(<PolicyDocument doc={doc} t={en.legal} englishOnly={false} />));
      expect(screen.getByRole("heading", { level: 1, name: en.legal.titles[slug] })).toBeInTheDocument();
      for (const s of doc.sections.filter((x) => x.heading)) {
        expect(container.querySelector(`#${CSS.escape(s.id)}`)).not.toBeNull();
      }
      const article = container.querySelector("article")!;
      expect(article.textContent).not.toMatch(/\[[^\]]+\]/);
      const bracketsInSource = JSON.stringify(doc).match(/\[[^\]"]+\]/g) ?? [];
      const marks = container.querySelectorAll("mark.pending-value");
      expect(marks.length).toBeGreaterThanOrEqual(bracketsInSource.length);
    });
  }

  it("no longer carries the outdated 'January 2025' pages", () => {
    const { container } = render(withI18n(<PolicyDocument doc={getPolicy("privacy")} t={en.legal} englishOnly={false} />));
    expect(container.textContent).not.toMatch(/January 2025/);
    expect(container.textContent).toMatch(/Digital Personal Data Protection Act, 2023/);
  });

  it("tells Hindi/Bengali readers the legal text is English-only until a reviewed translation exists", () => {
    render(withI18n(<PolicyDocument doc={getPolicy("terms")} t={en.legal} englishOnly />));
    expect(screen.getByText(en.legal.englishOnly)).toBeInTheDocument();
  });

  it("keeps documents 6 and 7 as content for the portals, not as public pages", () => {
    expect(ASSOCIATE_KYC_CONSENT_NOTICE.sections[0].blocks.length).toBeGreaterThan(5);
    expect(JSON.stringify(CUSTOMER_INFORMATION_NOTICE)).toMatch(/never to any individual/);
    expect(existsSync(path.resolve(root, "app/(site)/[lang]/associate-kyc-consent"))).toBe(false);
    expect(existsSync(path.resolve(root, "app/(site)/[lang]/customer-information-notice"))).toBe(false);
  });

  it("is generated from the supplied draft (v1.1)", () => {
    expect(draft).toMatch(/Policy Set \(Draft v1\.1\)/);
    expect(JSON.stringify(getPolicy("payment-policy"))).toContain("Grid Nova does not accept cash for any product or service, at any stage.");
  });
});
