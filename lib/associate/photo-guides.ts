// "How to take this photo" — 2–3 short tips per photo slot, shown under a
// toggle on every onboarding and installation-evidence photo slot.
//
// README: Example photos to be supplied by Grid Nova (one good photo per slot), placed in `public/portal/examples/`.
// Set `exampleImage` below to the file's public path (e.g.
// '/portal/examples/front.jpg') once it exists; until then the field stays
// empty and nothing is rendered. (The backend's own
// `example_image_url` on an onboarding photo slot, when it sends one, is shown
// by PhotoCaptureSlot already and takes precedence.)
//
// Tips are general photography guidance, not Grid Nova facts. Their text lives
// in messages/{en,hi,bn}.json → photoSlot.guide.tips.<tipsKey>.
import type en from '@/messages/en.json'

export type GuideTipsKey = keyof (typeof en)['photoSlot']['guide']['tips']

export interface PhotoGuide {
  tipsKey: GuideTipsKey
  /** Public path of an example photo; empty until Grid Nova supplies one. */
  exampleImage?: string
}

/**
 * Keyed by slot id: onboarding slots come from GET /associate/onboardings/options
 * `photo_slots[].key`; installation slots from the execution evidence list
 * (phase4a.md). A slot not listed here gets the general tips.
 */
export const PHOTO_GUIDES: Record<string, PhotoGuide> = {
  // Onboarding (associate_onboarding options).
  panel_installation_area: { tipsKey: 'panel_installation_area', exampleImage: '' },
  front: { tipsKey: 'front', exampleImage: '' },
  // Installation evidence (execution stages).
  array_installed: { tipsKey: 'array_installed', exampleImage: '' },
  inverter_installed: { tipsKey: 'inverter_installed', exampleImage: '' },
  earthing: { tipsKey: 'earthing', exampleImage: '' },
  meter_and_net_meter: { tipsKey: 'meter_and_net_meter', exampleImage: '' },
  completion_overview: { tipsKey: 'completion_overview', exampleImage: '' },
}

export const DEFAULT_PHOTO_GUIDE: PhotoGuide = { tipsKey: 'default' }

export function photoGuideFor(slotKey: string | undefined): PhotoGuide {
  return (slotKey && Object.hasOwn(PHOTO_GUIDES, slotKey) ? PHOTO_GUIDES[slotKey] : undefined) ?? DEFAULT_PHOTO_GUIDE
}
