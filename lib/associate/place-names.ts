/**
 * "PASCHIM BARDHAMAN" → "Paschim Bardhaman", for display only. Territory names arrive in
 * capitals from the LGD seed; a name already in mixed case is left exactly as it is, and the
 * stored value (the LGD code) is never touched.
 */
export function placeName(name: string): string {
  if (!name || name !== name.toUpperCase() || name === name.toLowerCase()) return name
  return name.toLowerCase().replace(/(^|[\s\-(/.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}
