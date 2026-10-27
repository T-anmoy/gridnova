'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Sparkles, X } from 'lucide-react'
import { NovaChat } from '@/components/dashboard/nova/NovaChat'
import { useNovaShell } from '@/lib/nova/page-context'
import { usePermissions } from '@/lib/access/use-permissions'

/**
 * The Ask Nova slide-over, openable from every dashboard page. It is only mounted while open,
 * so a closed panel costs nothing and makes no request. Following a citation link closes it.
 */
export function NovaPanel() {
  const { panelOpen, closePanel, context, draft } = useNovaShell()
  // The primary role only picks the starter questions' wording.
  const { primaryRole } = usePermissions()
  return (
    <DialogPrimitive.Root open={panelOpen} onOpenChange={(o) => (o ? undefined : closePanel())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[#091c3c]/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-testid="nova-panel"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a[href]')) closePanel()
          }}
          className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col gap-3 bg-white p-4 shadow-xl sm:max-w-xl"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#f7a800]" aria-hidden="true" />
            <DialogPrimitive.Title className="font-display text-base font-semibold text-[#091c3c]">Ask Nova</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close Ask Nova"
              className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-[#111827]/70 hover:bg-[#f7f9fc] focus-visible:outline-2 focus-visible:outline-[#f7a800]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1">
            <NovaChat variant="panel" role={primaryRole} context={context} draft={draft} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
