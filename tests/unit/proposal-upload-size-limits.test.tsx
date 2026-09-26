import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Step5Documents from '@/app/(internal)/proposal/new/steps/Step5Documents'
import { DEFAULT_FILES } from '@/app/(internal)/proposal/new/types'

// Regression test for the "one slot said 5MB" bug — every document slot on
// this step must advertise (and enforce) the same 10MB limit the backend
// actually enforces, so a file the UI silently accepts never gets a 413 the
// user was never warned about.
describe('Step5Documents — file size limits', () => {
  it('shows a 10MB hint for every upload slot, including Electricity Bill', () => {
    render(
      <Step5Documents
        files={DEFAULT_FILES}
        setFile={() => {}}
        schemeSelected={false}
        showDocumentErrors={false}
      />
    )
    const tenMbHints = screen.getAllByText(/up to 10MB each/i)
    // Electricity Bill, Site Photographs, Site Plan, Other Documents (govt
    // scheme registration is hidden when schemeSelected is false).
    expect(tenMbHints.length).toBe(4)
    expect(screen.queryByText(/up to 5MB each/i)).not.toBeInTheDocument()
  })
})
