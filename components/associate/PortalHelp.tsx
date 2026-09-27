import { Phone, Mail } from 'lucide-react'
import type { Messages } from '@/lib/i18n/types'

export default function PortalHelp({ copy }: { copy: Messages['associates']['portal']['associate']['help'] }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <p className="mt-2 text-sm text-[#111827]/60 leading-relaxed max-w-md">{copy.body}</p>
      <div className="mt-6 rounded-2xl border border-[#e4e8ee] bg-white p-6 space-y-3">
        <a href="tel:+919874774440" className="flex items-center gap-2.5 font-display text-[#0e2a63] font-semibold">
          <Phone className="h-4 w-4 text-[#f7a800]" /> {copy.callLabel}: +91 98747 74440
        </a>
        <a href="mailto:associates@gridnova.in" className="flex items-center gap-2.5 font-utility text-[#0e2a63]">
          <Mail className="h-4 w-4 text-[#f7a800]" /> {copy.emailLabel}: associates@gridnova.in
        </a>
      </div>
    </div>
  )
}
