'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ClerkProvider, useUser, useClerk, useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Menu,
  X,
  LogOut,
  ChevronRight,
  Zap,
  Sparkles,
} from 'lucide-react'
import { QueryProvider } from '@/components/dashboard/QueryProvider'
import { I18nProvider } from '@/lib/i18n/client'
import { STAFF_SHARED_MESSAGES } from '@/lib/dashboard/staff-copy'
import { NAV_ITEMS, canSeeNavItem, overdueServiceRequestCount, overdueSurveyCount, queueBadgeCount } from '@/lib/dashboard/nav'
import { useWorkQueues } from '@/lib/dashboard/execution-api-client'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import { NovaPanel } from '@/components/dashboard/nova/NovaPanel'
import { NovaShellProvider, useNovaShell } from '@/lib/nova/page-context'
import { canUseNova } from '@/lib/nova/logic'
import { Toaster } from '@/components/ui/sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useProposals, prefetchLeads, prefetchProposals, defaultLeadListParams } from '@/lib/dashboard/api-client'
import { cn } from '@/lib/dashboard/utils'
import { clearDraftsWithPrefix } from '@/lib/associate/useAutosaveDraft'
import { STAFF_REGISTER_DRAFT_PREFIX } from '@/lib/associate/serial-draft'
import type { Role } from '@/lib/dashboard/types'

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const qc = useQueryClient()
  const { getToken } = useAuth()
  const role = user?.publicMetadata?.role as Role | undefined

  const { data: pendingProposals } = useProposals({ status: 'pending_approval', page_size: 1 })
  const pendingCount = pendingProposals?.total ?? 0

  // Warm the destination's list cache on hover so the click feels instant.
  function prefetchFor(href: string) {
    if (href === '/dashboard/leads') void prefetchLeads(qc, getToken, defaultLeadListParams(role))
    else if (href === '/dashboard/proposals') void prefetchProposals(qc, getToken)
  }

  const { data: queues } = useWorkQueues()
  const canSee = (item: (typeof NAV_ITEMS)[number]) => canSeeNavItem(item, role)

  // The most specific entry wins, so /dashboard/archive/import lights up "Archive import" and not also "Project archive".
  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (!(pathname === href || pathname.startsWith(`${href}/`))) return false
    return !NAV_ITEMS.some((o) => o.href.length > href.length && o.href.startsWith(`${href}/`) && canSee(o) && (pathname === o.href || pathname.startsWith(`${o.href}/`)))
  }

  async function handleSignOut() {
    // Staff share machines too: typed-in serial rows must not outlive the session.
    clearDraftsWithPrefix([STAFF_REGISTER_DRAFT_PREFIX])
    await signOut()
    router.push('/')
  }

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-full flex-col bg-[#091c3c]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7a800]">
          <Zap className="h-4 w-4 text-[#091c3c]" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-white leading-tight">Grid Nova</p>
          <p className="font-utility text-[10px] text-white/60 uppercase tracking-wider">AI Operations</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#f7a800]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <Separator className="bg-white/10" />

      {/* Role badge */}
      {role && (
        <div className="px-6 py-3">
          <span className="font-utility text-[10px] uppercase tracking-wider text-white/55">Signed in as </span>
          <span className="font-utility text-[10px] uppercase tracking-wider text-[#f7a800]">{role}</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.filter(canSee).map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              onMouseEnter={() => prefetchFor(item.href)}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-utility transition-colors',
                active
                  ? 'bg-[#f7a800] text-[#091c3c] font-semibold'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.queue && queueBadgeCount(item.queue, queues) > 0 && (
                <Badge variant={active ? 'default' : 'amber'} className="min-w-[1.25rem] justify-center px-1.5 text-[10px]" data-testid={`queue-badge-${item.queue}`}>
                  {queueBadgeCount(item.queue, queues)}
                </Badge>
              )}
              {item.queue === 'survey_reviews' && overdueSurveyCount(queues) > 0 && (
                <Badge variant="red" className="px-1.5 text-[10px]" data-testid="queue-badge-survey-overdue">
                  {overdueSurveyCount(queues)} overdue
                </Badge>
              )}
              {item.queue === 'service_requests' && overdueServiceRequestCount(queues) > 0 && (
                <Badge variant="red" className="px-1.5 text-[10px]" data-testid="queue-badge-service-overdue">
                  {overdueServiceRequestCount(queues)} overdue
                </Badge>
              )}
              {item.badge && pendingCount > 0 && (
                <Badge variant={active ? 'default' : 'amber'} className="min-w-[1.25rem] justify-center px-1.5 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
              {active && <ChevronRight className="h-3 w-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-white/10 mx-3" />

      {/* User */}
      <div className="p-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[#0e2a63] text-white text-xs font-utility">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-utility text-white truncate">
              {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? 'User'}
            </p>
            <p className="text-xs font-utility text-white/60 truncate">
              {user?.emailAddresses?.[0]?.emailAddress ?? ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#f7a800]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Opens the Ask Nova slide-over. Hidden on the Nova page itself, where the chat is the page. */
function AskNovaButton({ className }: { className?: string }) {
  const { openPanel } = useNovaShell()
  const pathname = usePathname()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined
  if (!canUseNova(role) || pathname.startsWith('/dashboard/nova')) return null
  return (
    <Button type="button" variant="outline" className={cn('min-h-[44px]', className)} onClick={() => openPanel()}>
      <Sparkles className="h-4 w-4 text-[#f7a800]" aria-hidden="true" />
      Ask Nova
    </Button>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#091c3c] focus:shadow-lg"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 md:flex flex-col border-r border-white/10">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer — a modal dialog, so it is only mounted while
          open and gets a focus trap, Escape, aria-modal and focus return. */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 md:hidden" />
          <DialogPrimitive.Content
            id="dashboard-mobile-nav"
            aria-modal="true"
            // The drawer has no <Trigger>, so hand focus back to the menu button explicitly.
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              menuButtonRef.current?.focus()
            }}
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation menu</DialogPrimitive.Title>
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Mobile topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-[#e4e8ee] bg-white px-4 md:hidden">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-nav"
            aria-haspopup="dialog"
            className="h-11 w-11 shrink-0"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f7a800]">
              <Zap className="h-3 w-3 text-[#091c3c]" />
            </div>
            <span className="font-display text-sm font-semibold text-[#091c3c]">Grid Nova AI</span>
          </div>
          <AskNovaButton className="ml-auto" />
        </header>
        {/* Desktop top bar */}
        <div className="hidden items-center justify-end border-b border-[#e4e8ee] bg-white px-8 py-2 md:flex">
          <AskNovaButton />
        </div>

        {/* Page content */}
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 outline-none md:p-8">
          {children}
        </main>
      </div>

      <CommandPalette />
      <NovaPanel />
      <Toaster />
    </div>
  )
}

/**
 * The sign-in page lives under /dashboard, so it shares this layout. It must not get the shell:
 * the sidebar's work-queue query (and the Ask Nova button) need a signed-in user, and running
 * them for a signed-out visitor sent the page into a sign-in redirect loop.
 */
function ShellUnlessSignIn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/dashboard/sign-in')) return <>{children}</>
  return <DashboardShell>{children}</DashboardShell>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <QueryProvider>
        {/* The dashboard is English-only; the shared photo/upload components still read their strings from i18n. */}
        <I18nProvider locale="en" messages={STAFF_SHARED_MESSAGES}>
          <NovaShellProvider>
            <ShellUnlessSignIn>{children}</ShellUnlessSignIn>
          </NovaShellProvider>
        </I18nProvider>
      </QueryProvider>
    </ClerkProvider>
  )
}
