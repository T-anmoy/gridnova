import { notFound } from "next/navigation";

// Any unmatched public URL (after the proxy's locale rewrite) lands here so
// the localized not-found page renders inside the site layout.
export default function MissingPage() {
  notFound();
}
