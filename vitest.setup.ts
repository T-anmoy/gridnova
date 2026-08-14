import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import React from "react";

// Unmount React trees between tests so queries don't leak across cases.
afterEach(() => cleanup());

// next/link → a plain anchor. Unit tests don't need the App Router context,
// and rendering the real component would require it.
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string | { pathname?: string };
  } & Record<string, unknown>) =>
    React.createElement(
      "a",
      { href: typeof href === "string" ? href : "#", ...props },
      children,
    ),
}));

// next/navigation hooks used by client components under test.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));
