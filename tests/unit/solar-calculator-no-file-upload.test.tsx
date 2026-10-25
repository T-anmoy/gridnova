import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/(site)/[lang]/solar-calculator/SolarCalculator'
import { withI18n } from './helpers/i18n'
import { fillLocation, fillProperty } from './helpers/calculator'

// Regression test for the silent-discard bug: the public calculator used to
// show "Electricity Bill" / "Roof Photo" upload slots whose files were never
// sent anywhere (no public upload endpoint exists) — the visitor believed
// their file was submitted when it was quietly dropped. This step now shows
// an honest note instead of accepting files it can't use.

afterEach(() => {
  vi.restoreAllMocks()
})

async function reachSiteDetailsStep(user: ReturnType<typeof userEvent.setup>) {
  // The site questions now sit on the Usage step, under "Improve accuracy".
  await fillLocation(user)
  await fillProperty(user)
}

describe('SolarCalculator — the site questions never collect files', () => {
  it('shows no file upload controls and instead tells the visitor how to share files after submitting', async () => {
    window.scrollTo = vi.fn()
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await reachSiteDetailsStep(user)

    expect(screen.queryByText('Electricity Bill')).not.toBeInTheDocument()
    expect(screen.queryByText('Roof Photo')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/click to upload/i)).not.toBeInTheDocument()
    expect(screen.getByText(/share your electricity bill or roof photos/i)).toBeInTheDocument()
    expect(screen.getByText('+91 98747 74440')).toBeInTheDocument()
    expect(screen.getByText('info@gridnova.in')).toBeInTheDocument()
  })
})
