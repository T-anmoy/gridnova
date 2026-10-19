import CommissionsShell from '@/components/dashboard/commissions/CommissionsShell'

export default function CommissionsLayout({ children }: { children: React.ReactNode }) {
  return <CommissionsShell>{children}</CommissionsShell>
}
