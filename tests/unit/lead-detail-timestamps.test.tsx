import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import LeadDetailPage from "@/app/dashboard/leads/[id]/page";
import type { LeadDetail } from "@/lib/dashboard/types";

// This is the real, previously-broken display surface: the exact bug report
// was a lead's conversation timestamps on this page not matching when the
// conversation actually happened. These are real records from the backend's
// dev database (conversation_messages.id=80 / timeline_events.id=55,
// lead_id=19), after the paired backend session's UTCDateTime fix — the
// backend now serializes these with an explicit UTC offset
// ("...T15:51:23.398141+00:00"), which is 2026-09-06, 9:21 pm IST.
const REAL_MESSAGE_TIMESTAMP = "2026-09-06T15:51:23.398141+00:00";
const REAL_TIMELINE_TIMESTAMP = "2026-09-06T15:51:21.807708+00:00";

const MOCK_LEAD: LeadDetail = {
  lead_id: 19,
  customer: { id: 1, name: "Test Visitor", email: "test@example.com", company: null },
  pipeline_stage: "new",
  lead_score: null,
  collected_fields: {},
  proposals: [],
  timeline: [
    { event_type: "lead_created", description: "Lead created from website chat", created_at: REAL_TIMELINE_TIMESTAMP },
  ],
  messages: [
    { role: "customer", content: "Phase 3 proof - timestamp fix verification", created_at: "2026-09-06T15:51:21.812042+00:00" },
    { role: "agent", content: "Could you clarify what type of solar project this is for?", created_at: REAL_MESSAGE_TIMESTAMP },
  ],
};

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { publicMetadata: { role: "admin" } } }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "19" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/dashboard/api-client", () => ({
  useLead: () => ({ data: MOCK_LEAD, isLoading: false, error: null, refetch: vi.fn() }),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeLeadStage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReassignLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateLeadFields: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssignableEmployees: () => ({ data: [], isLoading: false }),
}));

describe("LeadDetailPage — conversation/timeline timestamps (the actual reported bug)", () => {
  // Forced to a real, non-IST zone for this whole file — this machine's own
  // local zone happens to already be Asia/Calcutta, which would let a
  // regression here slip through silently (the exact "only works by
  // coincidence" trap this fix exists to close). Running under a hostile
  // timezone is what actually proves the explicit Asia/Kolkata conversion,
  // not the environment, is what's producing the correct time.
  beforeAll(() => {
    vi.stubEnv("TZ", "America/Los_Angeles");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("renders the real backend records' timestamps as their correct IST time, not a browser-timezone-shifted one", () => {
    render(<LeadDetailPage />);
    // Both real messages and the real timeline event land in the same
    // minute (they're a rapid-fire verification exchange) — 2026-09-06,
    // 15:51 UTC is 06 Sept 2026, 09:21 pm in real IST. This must render
    // identically no matter what timezone this test happens to run in (CI,
    // a US laptop, etc.), because the shared utility now pins Asia/Kolkata
    // instead of trusting the browser's local zone.
    const matches = screen.getAllByText("06 Sept 2026, 09:21 pm");
    // 2 conversation messages + 1 timeline event = 3 real records rendered
    // through this exact page, all correctly converted.
    expect(matches).toHaveLength(3);
  });

  it("renders the real timeline event's description alongside its correct timestamp", () => {
    render(<LeadDetailPage />);
    expect(screen.getByText("Lead created from website chat")).toBeInTheDocument();
  });
});
