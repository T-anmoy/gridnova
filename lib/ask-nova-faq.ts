// Ask Nova FAQ content — fact-checked against the Grid Nova Energy company
// profile. This is a fixed, accurate question/answer set surfaced by the Ask
// Nova widget; it is NOT a live generative model. Edit copy here in one place.

export interface AskNovaFaq {
  /** Short question, shown in the typing bubble and as a tappable chip. */
  q: string;
  /** Full answer, typed out in the panel as if Nova is composing it. */
  a: string;
}

export const ASK_NOVA_FAQ: readonly AskNovaFaq[] = [
  {
    q: "What services does Grid Nova Energy offer?",
    a: "We offer five core services: Solar EPC (end-to-end engineering, procurement and construction), Green Energy Projects for residential, commercial and industrial clients, Grid-Scale Solar Infrastructure for utility-scale plants, Operation & Maintenance, and Energy Consulting including feasibility studies and full DISCOM support.",
  },
  {
    q: "Do you help with PM Surya Ghar subsidy paperwork?",
    a: "Yes — our residential scope includes full PM Surya Ghar subsidy documentation, net-metering DISCOM applications, structural load assessment, and long-term performance support.",
  },
  {
    q: "Do you install solar pumps under PM-KUSUM?",
    a: "Yes. Agricultural solar pumps deployed under the Prime Minister's Kisan Urja Suraksha evam Utthaan Mahabhiyan (PM-KUSUM) scheme are part of our government & institutional delivery.",
  },
  {
    q: "What industries do you serve?",
    a: "Four segments: Residential (homeowners & housing societies), Commercial (offices, hospitals, hotels, campuses), Industrial (manufacturing & processing facilities), and Government & Institutional (schools, municipal infrastructure, public-sector facilities).",
  },
  {
    q: "Do you offer maintenance after installation?",
    a: "Yes — every system includes preventive and corrective Operation & Maintenance to protect performance for the life of the installation. Our commitment doesn't end at commissioning.",
  },
  {
    q: "What's Grid Nova Energy's track record?",
    a: "Our leadership team and affiliated branches have collectively delivered 4,800+ street lamps, 330+ 10kW WBREDA schools, 2,350+ PM-KUSUM solar pumps, and 1,200+ PM Surya Ghar residential installations across West Bengal and Bihar.",
  },
] as const;
