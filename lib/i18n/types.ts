import type en from "@/messages/en.json";

/** Shape of every locale's message file — English is the source of truth. */
export type Messages = typeof en;

/** Replace `{name}` placeholders in a message. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
