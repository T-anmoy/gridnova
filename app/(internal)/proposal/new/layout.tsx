import { ClerkProvider } from "@clerk/nextjs";

// The assessment wizard uploads its documents straight from the browser to the
// backend with the staff member's Clerk token (Vercel Functions cap request
// bodies at 4.5 MB, below the wizard's 10 MB file limit). That needs a Clerk
// session on the client — scoped to /proposal/new only, so the customer-facing
// /proposal/accept pages never load Clerk.
export default function ProposalNewLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
