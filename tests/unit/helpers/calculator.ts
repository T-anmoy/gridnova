import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// Drives the public Solar Calculator (FE-14 steps): 1 Location, 2 Property,
// 3 Usage (units first, "Improve accuracy" collapsed), 4 Result, 5 Contact.

type User = ReturnType<typeof userEvent.setup>

export async function fillLocation(user: User, o: { state?: string; discom?: string; city?: string; pin?: string } = {}) {
  await user.selectOptions(screen.getByLabelText(/^state/i), o.state ?? 'West Bengal')
  if (o.discom) await user.selectOptions(screen.getByLabelText(/electricity company/i), o.discom)
  await user.type(screen.getByLabelText(/^city/i), o.city ?? 'Kolkata')
  await user.type(screen.getByLabelText(/pin code/i), o.pin ?? '700001')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 2 of 5/i)
}

export async function fillProperty(user: User, o: { houses?: string } = {}) {
  if (o.houses !== undefined) {
    await user.click(screen.getByRole('button', { name: /housing society/i }))
    await user.type(screen.getByLabelText(/how many flats/i), o.houses)
  }
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 3 of 5/i)
}

export interface UsageInput {
  units?: string
  bill?: string
  /** Bill-only or roof-only instead of units (the "I only know…" links). */
  only?: 'bill' | 'roof'
  roof?: string
  phase?: string
  sanctioned?: string
  improveRoof?: string
  shading?: string
  roofType?: string
}

export async function openImproveAccuracy(user: User) {
  const summary = screen.getByText(/improve accuracy/i).closest('summary')!
  if (!summary.parentElement!.hasAttribute('open')) await user.click(summary)
}

export async function enterUsage(user: User, o: UsageInput) {
  if (o.only === 'bill') {
    await user.click(screen.getByRole('button', { name: /only know my bill/i }))
    await user.type(screen.getByLabelText(/monthly electricity bill/i), o.bill ?? '')
  } else if (o.only === 'roof') {
    await user.click(screen.getByRole('button', { name: /only know my roof/i }))
    await user.type(screen.getByLabelText(/usable shadow-free roof area/i), o.roof ?? '')
  } else {
    if (o.units) await user.type(screen.getByLabelText(/units used per month/i), o.units)
    if (o.bill) await user.type(screen.getByLabelText(/bill amount/i), o.bill)
  }
  if (o.phase || o.sanctioned || o.improveRoof || o.shading || o.roofType) {
    await openImproveAccuracy(user)
    if (o.phase) await user.selectOptions(screen.getByLabelText(/connection phase/i), o.phase)
    if (o.sanctioned) await user.type(screen.getByLabelText(/sanctioned load/i), o.sanctioned)
    if (o.improveRoof) await user.type(screen.getByLabelText(/usable shadow-free roof area/i), o.improveRoof)
    if (o.shading) await user.selectOptions(screen.getByLabelText(/^shading/i), o.shading)
    if (o.roofType) await user.selectOptions(screen.getByLabelText(/roof type/i), o.roofType)
  }
}

export async function fillUsage(user: User, o: UsageInput) {
  await enterUsage(user, o)
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 4 of 5/i)
}

/** The usual path to the result: West Bengal home, bill only, single phase. */
export async function toResults(user: User, usage: UsageInput = { only: 'bill', bill: '3500', phase: 'Single Phase' }, houses?: string) {
  await fillLocation(user)
  await fillProperty(user, { houses })
  await fillUsage(user, usage)
}
