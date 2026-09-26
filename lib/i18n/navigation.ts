"use client";

import { usePathname } from "next/navigation";
import { splitLocale } from "./config";

/**
 * The browser pathname without its locale prefix (`/hi/about` → `/about`).
 * Use this for "is this link active?" checks so they work in every language.
 */
export function useBarePathname(): string {
  return splitLocale(usePathname() ?? "/").path;
}
