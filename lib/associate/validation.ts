// Lightweight client-side checks mirroring the contract's stated field rules,
// so a user gets instant feedback before submitting — the backend's 422
// response (with the exact field) remains the final authority.

export function isValidMobile(v: string): boolean {
  const digits = v.replace(/^\+?91/, '').replace(/^0/, '').replace(/\D/g, '')
  return /^[6-9]\d{9}$/.test(digits)
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function isValidPinCode(v: string): boolean {
  return /^[1-9]\d{5}$/.test(v)
}

export function isValidAadhaar(v: string): boolean {
  return /^\d{12}$/.test(v.replace(/\s/g, ''))
}

export function isValidPan(v: string): boolean {
  // An individual's PAN — 4th character P.
  return /^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/i.test(v)
}

export function isValidBankAccount(v: string): boolean {
  return /^\d{9,18}$/.test(v)
}

export function isValidIfsc(v: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(v)
}

export function isValidGstin(v: string): boolean {
  if (!v) return true
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d]$/i.test(v)
}

/** The backend's MINIMUM_AGE_YEARS (app/associates/validation.py check_adult). */
export const MIN_APPLICANT_AGE = 18

export function isAdult(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return false
  const eighteenthBirthday = new Date(birth.getFullYear() + MIN_APPLICANT_AGE, birth.getMonth(), birth.getDate())
  return eighteenthBirthday.getTime() <= Date.now()
}
