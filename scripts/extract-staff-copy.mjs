// Writes lib/dashboard/staff-copy.generated.json: the few message groups the
// English-only staff dashboard reuses, copied out of messages/en.json.
//
// Why: importing messages/en.json from a client component puts the WHOLE file
// (~140 KB: every page's marketing copy) into the dashboard bundle. This subset
// is ~28 KB. tests/unit/staff-copy-sync.test.ts fails if the generated file
// drifts from en.json, so it can never silently go stale.
//
//   npm run staff-copy        # regenerate after editing messages/en.json
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The subset, shared with the sync test. */
export function pickStaffCopy(en) {
  return {
    photoSlot: en.photoSlot,
    portalErrors: en.portalErrors,
    siteLocation: en.siteLocation,
    pricing: en.pricing,
    // The shared date field (components/forms/DateField.tsx) on staff screens.
    dateField: en.dateField,
    payments: en.associates.portal.payments,
    execution: en.associates.portal.execution,
    photos: en.associates.portal.wizard.photos,
    // Survey result warnings are shown to staff in the same words as to associates.
    survey: {
      warnings: en.survey.warnings,
      limiting: en.survey.results.limiting,
      fields: en.survey.fields,
      roofMaterials: en.survey.roofMaterials,
      nocStatuses: en.survey.nocStatuses,
      areaReasons: en.survey.areaReasons,
      sections: en.survey.status.sections,
    },
  }
}

/**
 * The staff Leads screens (FE-6) read their `staffLeads` namespace from here.
 * The dashboard is English-only, so only the English copy is carried; hi/bn
 * keep their `staffLeads` keys in messages/ for the i18n parity test.
 */
export function pickStaffLeadsCopy(en) {
  return { en: en.staffLeads }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (f) => JSON.parse(readFileSync(path.join(root, 'messages', f), 'utf8'))
  const en = read('en.json')
  const out = path.join(root, 'lib/dashboard/staff-copy.generated.json')
  writeFileSync(out, JSON.stringify(pickStaffCopy(en), null, 2) + '\n')
  console.log(`wrote ${path.relative(root, out)}`)
  const leadsOut = path.join(root, 'lib/dashboard/staff-leads-copy.generated.json')
  writeFileSync(leadsOut, JSON.stringify(pickStaffLeadsCopy(en), null, 2) + '\n')
  console.log(`wrote ${path.relative(root, leadsOut)}`)
}
