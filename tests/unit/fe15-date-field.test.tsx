import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { useState } from 'react'
import DateField from '@/components/forms/DateField'
import { I18nProvider } from '@/lib/i18n/client'
import { MIN_APPLICANT_AGE } from '@/lib/associate/validation'
import {
  addYears, birthdayAt, bounds, checkDate, fromIso, isRealDate, parseDateText, readBack, shiftMonths, todayIso,
} from '@/lib/date-field'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

// Fixed "today" so the age and future checks are deterministic. Only Date is
// faked: the lazy calendar chunk and user-event still need real timers.
const TODAY = '2026-10-25'
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T10:00:00'))
})
afterEach(() => vi.useRealTimers())

const MESSAGES = { en, hi, bn } as const

function Harness({ initial = '', locale = 'en' as 'en' | 'hi' | 'bn', onValue, ...props }: {
  initial?: string
  locale?: 'en' | 'hi' | 'bn'
  onValue?: (v: string) => void
} & Partial<React.ComponentProps<typeof DateField>>) {
  const [value, setValue] = useState(initial)
  return (
    <I18nProvider locale={locale} messages={{ dateField: MESSAGES[locale].dateField }}>
      <label htmlFor="dob">Date of birth</label>
      <DateField id="dob" label="Date of birth" value={value} onChange={(v) => { setValue(v); onValue?.(v) }} {...props} />
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue('1995-06-14')}>restore draft</button>
    </I18nProvider>
  )
}

const seg = (name: 'day' | 'month' | 'year') =>
  name === 'day' ? (screen.getByLabelText('Date of birth') as HTMLInputElement) : (screen.getByLabelText(`Date of birth, ${name}`) as HTMLInputElement)
const value = () => screen.getByTestId('value').textContent

describe('date logic (lib/date-field)', () => {
  it('knows real calendar dates, leap years included', () => {
    expect(isRealDate({ day: 31, month: 2, year: 2026 })).toBe(false)
    expect(isRealDate({ day: 31, month: 4, year: 2026 })).toBe(false)
    expect(isRealDate({ day: 29, month: 2, year: 2023 })).toBe(false)
    expect(isRealDate({ day: 29, month: 2, year: 2024 })).toBe(true)
    expect(isRealDate({ day: 29, month: 2, year: 1900 })).toBe(false)
    expect(isRealDate({ day: 29, month: 2, year: 2000 })).toBe(true)
  })

  it('parses every pasted format, day first', () => {
    const june = { day: 14, month: 6, year: 1995 }
    for (const t of ['14/06/1995', '14-06-1995', '14.06.1995', '14 06 1995', '14061995', '1995-06-14', ' 14/6/1995 ']) {
      expect(parseDateText(t), t).toEqual(june)
    }
    expect(parseDateText('June 14')).toBeNull()
    expect(parseDateText('31/02/2026')).toEqual({ day: 31, month: 2, year: 2026 })
  })

  it('date of birth rules match the backend (18 today, 29 Feb turns 18 on 1 Mar, not in the future)', () => {
    const dob = { minAge: MIN_APPLICANT_AGE, maxAge: 100 }
    expect(MIN_APPLICANT_AGE).toBe(18)
    expect(checkDate(fromIso('2008-10-25')!, { dob, today: TODAY })).toBeNull()
    expect(checkDate(fromIso('2008-10-26')!, { dob, today: TODAY })).toBe('underAge')
    expect(checkDate(fromIso('2026-10-26')!, { dob, today: TODAY })).toBe('future')
    expect(checkDate(fromIso('1926-10-24')!, { dob, today: TODAY })).toBe('tooOld')
    expect(birthdayAt('2008-02-29', 18)).toBe('2026-03-01')
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28')
    expect(bounds({ dob, today: TODAY })).toEqual({ min: '1926-10-25', max: '2008-10-25' })
    expect(shiftMonths('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('reads a date back in words in each language', () => {
    expect(readBack('1995-06-14', 'en')).toBe('14 June 1995')
    expect(readBack('1995-06-14', 'hi')).toContain('जून')
    expect(readBack('1995-06-14', 'bn')).toContain('জুন')
    expect(todayIso()).toBe(TODAY)
  })
})

describe('DateField — typing', () => {
  it('digits only, moves on by itself, and emits YYYY-MM-DD once complete', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness mode="dob" onValue={onValue} />)
    await user.type(seg('day'), '1a4')
    expect(seg('day').value).toBe('14')
    expect(seg('month')).toHaveFocus()
    await user.keyboard('06')
    expect(seg('year')).toHaveFocus()
    await user.keyboard('199')
    expect(value()).toBe('')
    await user.keyboard('5')
    expect(value()).toBe('1995-06-14')
    expect(onValue).toHaveBeenLastCalledWith('1995-06-14')
    expect(seg('day')).toHaveAttribute('inputmode', 'numeric')
  })

  it('a first digit that cannot start a two-digit value is padded and moves on (4 → 04)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(seg('day'), '4')
    expect(seg('day').value).toBe('04')
    expect(seg('month')).toHaveFocus()
    await user.keyboard('9')
    expect(seg('month').value).toBe('09')
    expect(seg('year')).toHaveFocus()
  })

  it('a typed separator pads and moves on', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(seg('day'), '1/2/2026')
    expect(value()).toBe('2026-02-01')
  })

  it('Backspace in an empty segment goes back and deletes there', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(seg('day'), '1406')
    expect(seg('year')).toHaveFocus()
    await user.keyboard('{Backspace}')
    expect(seg('month')).toHaveFocus()
    expect(seg('month').value).toBe('0')
  })

  it('arrow keys step values; Tab moves between segments', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2024-02-28" />)
    seg('day').focus()
    await user.keyboard('{ArrowUp}')
    expect(value()).toBe('2024-02-29')
    await user.keyboard('{ArrowUp}')
    expect(value()).toBe('2024-02-01') // wraps within February of a leap year
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(value()).toBe('2024-02-28')
    await user.tab()
    expect(seg('month')).toHaveFocus()
  })

  it('an empty date-of-birth year steps from 30 years back', async () => {
    const user = userEvent.setup()
    render(<Harness mode="dob" />)
    seg('year').focus()
    await user.keyboard('{ArrowUp}')
    expect(seg('year').value).toBe('1996')
  })

  it('accepts pasted 14/06/1995, 14-06-1995, 14.06.1995 and 1995-06-14', () => {
    for (const text of ['14/06/1995', '14-06-1995', '14.06.1995', '1995-06-14']) {
      const { unmount } = render(<Harness />)
      fireEvent.paste(seg('month'), { clipboardData: { getData: () => text } })
      expect(value(), text).toBe('1995-06-14')
      expect([seg('day').value, seg('month').value, seg('year').value]).toEqual(['14', '06', '1995'])
      unmount()
    }
  })
})

describe('DateField — validation and read-back', () => {
  it('refuses dates that do not exist; 29/02/2024 is fine', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(seg('day'), '31022026')
    expect(value()).toBe('')
    expect(screen.getByText(en.dateField.invalid)).toBeInTheDocument()
    expect(seg('day')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '29/02/2023' } })
    expect(value()).toBe('')
    expect(screen.getByText(en.dateField.invalid)).toBeInTheDocument()
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '29/02/2024' } })
    expect(value()).toBe('2024-02-29')
    expect(screen.queryByText(en.dateField.invalid)).toBeNull()
    expect(screen.getByText('29 February 2024')).toBeInTheDocument()
  })

  it('reads the date back in words, so a swapped day and month is obvious', () => {
    render(<Harness initial="1995-06-14" />)
    const status = screen.getByText('14 June 1995')
    expect(status.closest('p')).toHaveAttribute('aria-live', 'polite')
    expect(seg('day').getAttribute('aria-describedby')).toContain(status.closest('p')!.id)
  })

  it('date of birth: the future and under-18 are refused with plain messages; 18 today is fine', () => {
    render(<Harness mode="dob" minAge={MIN_APPLICANT_AGE} />)
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '01/01/2027' } })
    expect(screen.getByText(en.dateField.future)).toBeInTheDocument()
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '26/10/2008' } })
    expect(screen.getByText('You must be at least 18 years old.')).toBeInTheDocument()
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '25/10/2008' } })
    expect(screen.queryByText(/at least 18/)).toBeNull()
    expect(screen.getByText('25 October 2008')).toBeInTheDocument()
  })

  it('a half-typed date is pointed out only after leaving the field', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(seg('day'), '14')
    expect(seg('month')).toHaveFocus()
    expect(screen.queryByText(en.dateField.incomplete)).toBeNull()
    await user.tab() // to the year: still inside the field
    expect(screen.queryByText(en.dateField.incomplete)).toBeNull()
    await user.click(document.body)
    expect(screen.getByText(en.dateField.incomplete)).toBeInTheDocument()
    expect(value()).toBe('')
  })

  it('a value set from outside (a restored draft) replaces what was half-typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(seg('day'), '3')
    await user.click(screen.getByRole('button', { name: 'restore draft' }))
    expect([seg('day').value, seg('month').value, seg('year').value]).toEqual(['14', '06', '1995'])
    expect(value()).toBe('1995-06-14')
    expect(screen.getByText('14 June 1995')).toBeInTheDocument()
  })

  it('min / max are respected with a message naming the limit', () => {
    render(<Harness min="2026-11-01" max="2026-11-30" />)
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '31/10/2026' } })
    expect(screen.getByText('Choose 1 November 2026 or later.')).toBeInTheDocument()
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '01/12/2026' } })
    expect(screen.getByText('Choose 30 November 2026 or earlier.')).toBeInTheDocument()
  })

  it('messages come in Hindi and Bengali on those pages', () => {
    const { unmount } = render(<Harness locale="hi" mode="dob" />)
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '31/02/2026' } })
    expect(screen.getByText(hi.dateField.invalid)).toBeInTheDocument()
    unmount()
    render(<Harness locale="bn" mode="dob" />)
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '26/10/2008' } })
    expect(screen.getByText('আপনার বয়স অন্তত 18 বছর হতে হবে।')).toBeInTheDocument()
    fireEvent.paste(seg('day'), { clipboardData: { getData: () => '14/06/1995' } })
    expect(screen.getByText(readBack('1995-06-14', 'bn'))).toBeInTheDocument()
  })
})

describe('DateField — calendar', () => {
  async function openCalendar(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: en.dateField.openCalendar }))
    return screen.findByRole('dialog', { name: en.dateField.calendarLabel })
  }

  it('opens on a sensible birth year, with month and year dropdowns (a year 60 back is two choices)', async () => {
    const user = userEvent.setup()
    render(<Harness mode="dob" />)
    const cal = await openCalendar(user)
    const year = within(cal).getByRole('combobox', { name: en.dateField.yearSelect }) as HTMLSelectElement
    const month = within(cal).getByRole('combobox', { name: en.dateField.monthSelect }) as HTMLSelectElement
    expect(year.value).toBe('1996')
    // Oldest year 100 back, newest the year someone turning 18 today was born.
    expect(year.options[0].value).toBe('1926')
    expect(year.options[year.options.length - 1].value).toBe('2008')
    await user.selectOptions(year, '1966')
    await user.selectOptions(month, '3')
    await user.click(within(cal).getByRole('button', { name: /\b14 March 1966/ }))
    expect(value()).toBe('1966-03-14')
    expect([seg('day').value, seg('month').value, seg('year').value]).toEqual(['14', '03', '1966'])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: en.dateField.openCalendar })).toHaveFocus()
  })

  it('typing updates the calendar; the calendar marks today and the chosen day', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(seg('day'), '14062026')
    const cal = await openCalendar(user)
    expect((within(cal).getByRole('combobox', { name: en.dateField.monthSelect }) as HTMLSelectElement).value).toBe('6')
    expect(within(cal).getByRole('button', { name: /\b14 June 2026/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(cal).getByRole('button', { name: /\b14 June 2026/ })).toHaveFocus()
    await user.selectOptions(within(cal).getByRole('combobox', { name: en.dateField.monthSelect }), '10')
    expect(within(cal).getByRole('button', { name: /\b25 October 2026/ })).toHaveAttribute('aria-current', 'date')
  })

  it('days outside min / max cannot be picked', async () => {
    const user = userEvent.setup()
    render(<Harness min="2026-10-20" max="2026-10-28" />)
    const cal = await openCalendar(user)
    expect(within(cal).getByRole('button', { name: /\b19 October 2026/ })).toBeDisabled()
    expect(within(cal).getByRole('button', { name: /\b20 October 2026/ })).toBeEnabled()
    expect(within(cal).getByRole('button', { name: /\b29 October 2026/ })).toBeDisabled()
  })

  it('works by keyboard alone: arrows by day and week, Page Down by month, Enter picks, Escape closes', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-01-15" />)
    await user.tab() // day
    await user.tab() // month
    await user.tab() // year
    await user.tab() // calendar button
    expect(screen.getByRole('button', { name: en.dateField.openCalendar })).toHaveFocus()
    await user.keyboard('{Enter}')
    const cal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(cal).getByRole('button', { name: /\b15 January 2026/ })).toHaveFocus())
    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(within(cal).getByRole('button', { name: /\b23 January 2026/ })).toHaveFocus()
    await user.keyboard('{PageDown}')
    expect(within(cal).getByRole('button', { name: /\b23 February 2026/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(value()).toBe('2026-02-23')
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: en.dateField.openCalendar })).toHaveFocus()
  })
})

describe('DateField — forms and accessibility', () => {
  it('posts the ISO value through a hidden input when used inside a plain form', () => {
    render(
      <form data-testid="f">
        <DateField label="From" name="from" defaultValue="2026-07-01" />
      </form>,
    )
    expect(new FormData(screen.getByTestId('f') as HTMLFormElement).get('from')).toBe('2026-07-01')
    fireEvent.paste(within(screen.getByRole('group', { name: 'From' })).getAllByRole('textbox')[0], { clipboardData: { getData: () => '02/08/2026' } })
    expect(new FormData(screen.getByTestId('f') as HTMLFormElement).get('from')).toBe('2026-08-02')
  })

  it('labels every segment and has no axe violations, closed and open', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness mode="dob" initial="1995-06-14" />)
    expect(seg('month')).toHaveAccessibleName('Date of birth, month')
    expect(seg('year')).toHaveAccessibleName('Date of birth, year')
    const run = async () => (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations
    expect(await run()).toEqual([])
    await user.click(screen.getByRole('button', { name: en.dateField.openCalendar }))
    await screen.findByRole('dialog')
    expect(await act(run)).toEqual([])
  })
})

describe('DateField — closing the calendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T10:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('a press outside closes it; a press on its own padding does not', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: en.dateField.openCalendar }))
    const cal = await screen.findByRole('dialog')
    await user.click(within(cal).getByRole('grid')) // the table itself, not a day
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
