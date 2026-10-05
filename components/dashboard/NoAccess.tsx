import { ShieldOff } from 'lucide-react'

export default function NoAccess({ what }: { what: string }) {
  return (
    <div className="p-6 md:p-8">
      <div role="alert" data-testid="no-access" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-utility font-medium text-amber-800">Not available for your role</p>
          <p className="mt-1 text-sm text-amber-700">{what} isn’t part of your role’s access. Contact an admin if you think this is wrong.</p>
        </div>
      </div>
    </div>
  )
}
