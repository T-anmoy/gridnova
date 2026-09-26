"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/lib/i18n/client";
import { localizeHref } from "@/lib/i18n/config";

type Props = Omit<ComponentProps<typeof NextLink>, "href"> & { href: string };

/**
 * next/link that keeps the visitor in their current language: `/about`
 * becomes `/hi/about` on a Hindi page. Internal-tool routes (`/dashboard`,
 * `/proposal`) and external/mailto/tel links pass through unchanged.
 */
export default function Link({ href, ...rest }: Props) {
  const locale = useLocale();
  return <NextLink href={localizeHref(href, locale)} {...rest} />;
}
