'use client'

import { useParams } from 'next/navigation'
import PayoutBatchDetail from '@/components/dashboard/commissions/PayoutBatchDetail'

export default function PayoutBatchPage() {
  const { id } = useParams<{ id: string }>()
  return <PayoutBatchDetail batchId={Number(id)} />
}
