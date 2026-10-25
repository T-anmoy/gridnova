import { fireEvent, within } from "@testing-library/react";

// Drives components/forms/DateField.tsx. With a visible label the label names
// the day box; without one the field's `label` names the group. Either way
// these helpers find the field by that name.

/** The date field's group, found by its label. */
export function dateGroup(name: string | RegExp, root: HTMLElement = document.body): HTMLElement {
  const el = within(root).getAllByLabelText(name).find((e) => e.getAttribute("role") === "group" || e.closest("[role=group]"))!;
  return el.getAttribute("role") === "group" ? el : (el.closest("[role=group]") as HTMLElement);
}

/** The first (day) segment, where typing and pasting start. */
export function dayInput(name: string | RegExp, root: HTMLElement = document.body): HTMLInputElement {
  return dateGroup(name, root).querySelector("input") as HTMLInputElement;
}

/** Fill the date field named `name` with `iso` (YYYY-MM-DD), as a paste. */
export function fillDateField(name: string | RegExp, iso: string, root: HTMLElement = document.body): void {
  fireEvent.paste(dayInput(name, root), { clipboardData: { getData: () => iso } });
}

/** Type a date into the field named `name` key by key, day first, as a person would ("01012026"). */
export async function typeDateField(
  user: { type: (el: Element, text: string) => Promise<void> },
  name: string | RegExp,
  digits: string,
): Promise<void> {
  await user.type(dayInput(name), digits);
}
