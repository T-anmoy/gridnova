import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Grid Nova Energy collects, uses and protects your personal information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="bg-white pt-[calc(var(--header-h)+3rem)] pb-24">
      <div className="mx-auto max-w-[760px] px-6">
        {/* Draft disclaimer */}
        <div className="mb-10 rounded-xl border border-[#f7a800]/40 bg-[#f7a800]/8 px-5 py-4 text-sm text-[#111827]/70 leading-relaxed">
          <strong className="font-semibold text-[#0e2a63]">Note:</strong> This is a draft
          template and should be reviewed by legal counsel before publication.
        </div>

        <p className="font-utility text-[11px] tracking-[0.18em] text-[#2f5daa]/70 uppercase mb-4">
          Legal
        </p>
        <h1 className="font-display text-[#0e2a63] text-4xl font-semibold mb-2">
          Privacy Policy
        </h1>
        <p className="text-[#111827]/45 text-sm font-utility mb-12">
          Last updated: January 2025
        </p>

        <div className="prose prose-slate max-w-none space-y-10 text-[#111827]/75 leading-relaxed">
          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">1. Who We Are</h2>
            <p>
              Grid Nova Energy (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the Company&rdquo;) is a renewable energy
              company registered in India, with its head office at Plot No. 83, Kasba Industrial
              Estate, Phase II, Kolkata – 700107, West Bengal. We operate the website
              www.gridnova.in (&ldquo;the Site&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p>We collect personal information only when you voluntarily provide it, including:</p>
            <ul className="mt-3 space-y-2 pl-5 list-disc">
              <li>Name, email address, phone number and message content submitted via our contact form.</li>
              <li>Email address and enquiry details submitted via mailto links.</li>
              <li>Anonymous usage data collected via cookies (see Section 6).</li>
            </ul>
            <p className="mt-4">
              We do not collect sensitive personal data (financial information, government IDs,
              health data) through this website.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p>Information you provide is used solely to:</p>
            <ul className="mt-3 space-y-2 pl-5 list-disc">
              <li>Respond to your enquiry or project request.</li>
              <li>Communicate about our services, products and offers relevant to your enquiry.</li>
              <li>Improve the Site and our service offerings.</li>
            </ul>
            <p className="mt-4">
              We do not sell, rent or trade your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">4. Data Storage and Retention</h2>
            <p>
              Personal data is stored on secure servers located in India. We retain enquiry
              data for a maximum of 24 months from the date of receipt, after which it is
              deleted or anonymised.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="mt-3 space-y-2 pl-5 list-disc">
              <li>Request access to the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data, subject to any legal obligations.</li>
              <li>Withdraw consent at any time for any marketing communications.</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:info@gridnova.in" className="text-[#2f5daa] underline">
                info@gridnova.in
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">6. Cookies</h2>
            <p>
              The Site may use essential cookies to ensure basic functionality. No
              advertising, tracking or third-party analytics cookies are set without your
              explicit consent. You can control cookie settings through your browser
              preferences.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">7. Third-Party Links</h2>
            <p>
              The Site may contain links to external websites. We are not responsible for the
              privacy practices of those sites and encourage you to review their policies
              independently.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">8. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of India, including the Information
              Technology Act, 2000 and applicable rules thereunder. Any disputes shall be
              subject to the exclusive jurisdiction of courts in Kolkata, West Bengal.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Significant changes will be
              communicated via a prominent notice on the Site. Continued use of the Site after
              changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">10. Contact</h2>
            <p>
              For privacy-related queries, write to us at{" "}
              <a href="mailto:info@gridnova.in" className="text-[#2f5daa] underline">
                info@gridnova.in
              </a>{" "}
              or call +91 98747 74440.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
