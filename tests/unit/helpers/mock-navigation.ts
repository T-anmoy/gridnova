import { useSyncExternalStore } from 'react'
import { vi } from 'vitest'

// A stateful stand-in for next/navigation: `router.replace` really changes the
// URL and re-renders subscribers, so pages that keep their state in the query
// string can be driven end to end. Use from a vi.mock factory:
//   vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)
let search = ''
let pathname = '/'
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const navState = {
  reset(initialPath = '/', initialSearch = '') {
    pathname = initialPath
    search = initialSearch.replace(/^\?/, '')
    replace.mockClear()
    push.mockClear()
    emit()
  },
  get search() {
    return search
  },
  get params() {
    return new URLSearchParams(search)
  },
}

function apply(url: string) {
  const [path, qs = ''] = url.split('?')
  pathname = path
  search = qs
  emit()
}

export const replace = vi.fn((url: string) => apply(url))
export const push = vi.fn((url: string) => apply(url))

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const navigationMock = {
  useRouter: () => ({ push, replace, back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => useSyncExternalStore(subscribe, () => pathname, () => pathname),
  useSearchParams: () => {
    const s = useSyncExternalStore(subscribe, () => search, () => search)
    return new URLSearchParams(s)
  },
  useParams: () => ({}),
}
