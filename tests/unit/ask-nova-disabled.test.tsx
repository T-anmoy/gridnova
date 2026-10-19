// The production kill-switch NEXT_PUBLIC_ASK_NOVA_ENABLED=false is read once, at
// module load (lib/config.ts), so each case stubs the env, resets the module
// registry and imports AskNova afresh.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import en from '@/messages/en.json'

beforeEach(() => {
  vi.resetModules()
  sessionStorage.clear()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function mount() {
  // Imported after the reset so AskNova and the provider share one module graph (one React context).
  const { default: AskNova } = await import('@/components/AskNova')
  const { withI18n } = await import('./helpers/i18n')
  render(withI18n(<AskNova />))
  fireEvent.click(screen.getByRole('button', { name: en.nova.open }))
}

describe('Ask Nova — kill-switch (NEXT_PUBLIC_ASK_NOVA_ENABLED=false)', () => {
  it('shows the offline greeting and no message box, and never touches the network', async () => {
    vi.stubEnv('NEXT_PUBLIC_ASK_NOVA_ENABLED', 'false')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await mount()

    expect(screen.getByText(en.nova.greetingOffline)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: en.nova.inputLabel })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is on by default: the live greeting and the message box are there', async () => {
    vi.stubEnv('NEXT_PUBLIC_ASK_NOVA_ENABLED', '')
    await mount()
    expect(screen.getByText(en.nova.greeting)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: en.nova.inputLabel })).toBeInTheDocument()
  })

  it('only the exact string "false" turns it off (a typo does not silently disable chat)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ASK_NOVA_ENABLED', 'False ')
    await mount()
    expect(screen.getByRole('textbox', { name: en.nova.inputLabel })).toBeInTheDocument()
  })
})
