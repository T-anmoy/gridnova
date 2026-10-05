'use client'

import { useEffect, useState } from 'react'
import { fetchPackageCatalogue, type PackageCatalogue } from './price-list'

/**
 * The public package catalogue. Works on any page (no query provider needed);
 * a failure just means the cards show without makes — never an error page.
 */
export function usePackageCatalogue(): { catalogue: PackageCatalogue | null; status: 'loading' | 'ready' | 'error' } {
  const [state, setState] = useState<{ catalogue: PackageCatalogue | null; status: 'loading' | 'ready' | 'error' }>({
    catalogue: null,
    status: 'loading',
  })
  useEffect(() => {
    const ctl = new AbortController()
    fetchPackageCatalogue(ctl.signal)
      .then((catalogue) => setState({ catalogue, status: 'ready' }))
      .catch(() => {
        if (!ctl.signal.aborted) setState({ catalogue: null, status: 'error' })
      })
    return () => ctl.abort()
  }, [])
  return state
}
