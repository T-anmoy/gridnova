// The rooftop customer journey, in order. The homepage explains these steps;
// the customer portal's progress bar (Phase 3) must use the same ids and order
// so what we promise publicly matches what a customer sees on their project.
// Step names and descriptions live in messages: home.journey.steps.
export const JOURNEY_STEP_IDS = [
  "enquiry",
  "survey",
  "proposal",
  "agreement",
  "installation",
  "inspection",
  "commissioning",
  "subsidy",
] as const;

export type JourneyStepId = (typeof JOURNEY_STEP_IDS)[number];
