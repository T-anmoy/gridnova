import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "Terms and conditions governing use of the Grid Nova Energy website.",
  path: "/terms",
});

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-[#111827]/45 text-sm font-utility mb-12">
          Last updated: January 2025
        </p>

        <div className="prose prose-slate max-w-none space-y-10 text-[#111827]/75 leading-relaxed">
          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using www.gridnova.in (&ldquo;the Site&rdquo;), you agree to be bound
              by these Terms of Service. If you do not agree to these terms, please do not use
              the Site. Grid Nova Energy reserves the right to update these terms at any time.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">2. Use of the Site</h2>
            <p>The Site is intended for informational purposes related to our solar EPC services. You agree not to:</p>
            <ul className="mt-3 space-y-2 pl-5 list-disc">
              <li>Use the Site for any unlawful purpose or in violation of applicable laws.</li>
              <li>Attempt to gain unauthorised access to any part of the Site or its systems.</li>
              <li>Reproduce, distribute or commercially exploit Site content without written permission.</li>
              <li>Submit false, misleading or fraudulent information through any contact form.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">3. Intellectual Property</h2>
            <p>
              All content on the Site — including text, graphics, logos, icons and images — is the
              property of Grid Nova Energy or its content suppliers and is protected by applicable
              Indian and international intellectual property laws. No content may be reproduced
              without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">4. No Professional Advice</h2>
            <p>
              Content on the Site is for general informational purposes only. It does not
              constitute engineering, legal, financial or regulatory advice. Always engage a
              qualified professional for project-specific decisions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">5. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Grid Nova Energy shall not be liable for
              any indirect, incidental, special or consequential damages arising from your use of
              the Site. Our total liability for any claim shall not exceed INR 1,000.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">6. Third-Party Links</h2>
            <p>
              The Site may link to third-party websites for convenience. Grid Nova Energy does not
              endorse or control those sites and is not responsible for their content or privacy
              practices.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">7. Governing Law and Jurisdiction</h2>
            <p>
              These Terms are governed by the laws of India. Any dispute arising out of or in
              connection with these Terms shall be subject to the exclusive jurisdiction of
              competent courts in Kolkata, West Bengal, India.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-3">8. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:info@gridnova.in" className="text-[#2f5daa] underline">
                info@gridnova.in
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#e4e8ee] flex gap-4">
          <Link href="/privacy" className="text-[#2f5daa] text-sm font-utility hover:underline">
            Privacy Policy
          </Link>
          <Link href="/contact" className="text-[#2f5daa] text-sm font-utility hover:underline">
            Contact Us
          </Link>
        </div>
      </div>
    </main>
  );
}
