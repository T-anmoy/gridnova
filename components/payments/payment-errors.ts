import { ApiError } from '@/lib/dashboard/api-error'
import { formatInr } from '@/lib/money'
import type { Messages } from '@/lib/i18n/types'

export type PaymentCopy = Messages['associates']['portal']['payments']

/**
 * Plain-words message for a payment API failure, keyed on the contract's
 * `detail.code`. `exceeds_project_total` carries `accepted_total` and
 * `already_recorded` (decimal strings, shown as returned — never added up here).
 */
export function paymentErrorMessage(err: unknown, copy: PaymentCopy): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (typeof code === 'string' && code in copy.errors) {
      const template = copy.errors[code as keyof PaymentCopy['errors']]
      if (code === 'exceeds_project_total') {
        const d = err.structuredDetail ?? {}
        return template
          .replace('{total}', formatInr(typeof d.accepted_total === 'string' ? d.accepted_total : null))
          .replace('{recorded}', formatInr(typeof d.already_recorded === 'string' ? d.already_recorded : null))
      }
      return template
    }
    if (err.status === 413) return copy.errors.file_too_large
  }
  return copy.errors.generic
}
