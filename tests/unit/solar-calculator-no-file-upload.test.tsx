import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/solar-calculator/SolarCalculator'

// Regression test for the silent-discard bug: the public calculator used to
// show "Electricity Bill" / "Roof Photo" upload slots whose files were never
// sent anywhere (no public upload endpoint exists) — the visitor believed
// their file was submitted when it was quietly dropped. This step now shows
// an honest note instead of accepting files it can't use.

afterEach(() => {
  vi.restoreAllMocks()
})

async function reachSiteDetailsStep(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^state/i), 'West Bengal')
  await user.type(screen.getByLabelText(/^city/i), 'Kolkata')
  await user.type(screen.getByLabelText(/pin code/i), '700001')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 2 of 5/i)
  await user.type(screen.getByLabelText(/average monthly electricity bill/i), '3500')
  await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Single Phase')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 3 of 5/i)
}

describe('SolarCalculator — Site Details step no longer collects files', () => {
  it('shows no file upload controls and instead tells the visitor how to share files after submitting', async () => {
    window.scrollTo = vi.fn()
    const user = userEvent.setup()
    render(<SolarCalculator />)
    await reachSiteDetailsStep(user)

    expect(screen.queryByText('Electricity Bill')).not.toBeInTheDocument()
    expect(screen.queryByText('Roof Photo')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/click to upload/i)).not.toBeInTheDocument()
    expect(screen.getByText(/share your electricity bill or roof photos/i)).toBeInTheDocument()
    expect(screen.getByText('+91 98747 74440')).toBeInTheDocument()
    expect(screen.getByText('info@gridnova.in')).toBeInTheDocument()
  })
})
