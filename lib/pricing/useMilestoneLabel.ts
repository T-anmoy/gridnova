import { useOptionalMessages } from '@/lib/i18n/client'
import { localizeMilestoneLabel } from '@/lib/pricing/terms'

/** The instalment name in the page language; identity when the pricing messages aren't provided. */
export function useMilestoneLabel(): (label: string) => string {
  const pricing = useOptionalMessages('pricing')
  return (label) => (pricing ? localizeMilestoneLabel(label, pricing.terms) : label)
}
