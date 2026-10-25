/** A copy of `obj` without `keys` — e.g. a BE-14 response made to look older. */
export function without<T extends object>(obj: T, ...keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)))
}
