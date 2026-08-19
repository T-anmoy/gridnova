import { describe, it, expect } from "vitest";
import {
  overviewStatsSchema,
  activityFeedResponseSchema,
  conversionBySourceResponseSchema,
  pipelineTrendResponseSchema,
  formatZodError,
} from "@/lib/dashboard/schemas";
import { validateAcceptResponse } from "@/lib/proposal-accept";
import { ApiShapeError } from "@/lib/dashboard/api-error";

// Regression coverage for the exact bug class this validation layer exists
// to catch: a frontend type asserting a shape the backend doesn't actually
// return. Each case here mirrors a real mismatch found and fixed in this
// codebase — a deliberately malformed mock response should fail loudly with
// a field-specific message, never crash downstream or render silently wrong.

describe("runtime shape validation — malformed responses fail loudly, not silently", () => {
  it("rejects overview-stats with the old {delta, direction} trend shape instead of a bare number", () => {
    const malformed = {
      new_leads_today: 1,
      follow_ups_due: 0,
      pending_approval: 0,
      pending_manager_signoff: 0,
      trends: {
        new_leads_today: { delta: 1, direction: "up" }, // wrong shape
        follow_ups_due: 0,
        pending_approval: 0,
        pending_manager_signoff: 0,
      },
    };
    const result = overviewStatsSchema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = formatZodError(result.error);
      expect(msg).toContain("trends.new_leads_today");
    }
  });

  it("rejects an activity feed sent as a bare array instead of the {items: [...]} envelope", () => {
    const malformed = [{ description: "x", entity_type: "lead", entity_id: "1", action: "created", actor: null, created_at: null }];
    const result = activityFeedResponseSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects conversion-by-source rows using the old leads/converted field names", () => {
    const malformed = { by_source: [{ source: "web", leads: 10, converted: 2, conversion_rate: 0.2 }] };
    const result = conversionBySourceResponseSchema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = formatZodError(result.error);
      expect(msg).toContain("by_source.0.total_leads");
    }
  });

  it("rejects pipeline-trend points keyed by `week` instead of `week_start`", () => {
    const malformed = { weeks: [{ week: "2026-01-01", leads_created: 1, proposals_won: 0 }] };
    const result = pipelineTrendResponseSchema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = formatZodError(result.error);
      expect(msg).toContain("weeks.0.week_start");
    }
  });

  it("proposal-accept: throws a clear ApiShapeError (not a crash) when scope is a number instead of a string or section array", () => {
    const malformed = { proposal_id: 1, scope: 12345, price: 1000, state: "acceptable" };
    expect(() => validateAcceptResponse(malformed)).toThrow(ApiShapeError);
    try {
      validateAcceptResponse(malformed);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiShapeError);
      expect((e as ApiShapeError).message).toContain("scope");
    }
  });

  it("proposal-accept: still accepts the real backend shape (array of {id, body} sections)", () => {
    const real = {
      proposal_id: 1,
      version: 1,
      scope: [{ id: "s1", body: "Scope text" }],
      price: 250000,
      valid_until: "2026-09-01T00:00:00Z",
      state: "acceptable",
      accepted_at: null,
    };
    expect(() => validateAcceptResponse(real)).not.toThrow();
  });
});
