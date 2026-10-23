'use client'

// The one consent line shown when the visitor came through an Associate's
// referral link. Unticked by default; ticking it is the only way
// `share_with_referrer: true` is ever sent.
export default function ReferralConsent({
  label,
  checked,
  onChange,
  tone = 'light',
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  tone?: 'light' | 'dark'
}) {
  return (
    <label
      data-testid="referral-consent"
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 py-2 text-sm leading-snug ${tone === 'dark' ? 'text-white/80' : 'text-[#111827]/75'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#e4e8ee] accent-[#0e2a63]"
      />
      <span>{label}</span>
    </label>
  )
}
