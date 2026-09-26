import {
  Space_Grotesk,
  Manrope,
  IBM_Plex_Sans,
  Noto_Sans_Devanagari,
  Noto_Sans_Bengali,
} from "next/font/google";
import type { Script } from "@/lib/i18n/config";

// Self-hosted via next/font — no external request to Google at runtime.
// The Latin faces set `--font-*-face`; globals.css builds the real
// `--font-display` / `--font-body` / `--font-utility` stacks from them, with
// the script face (`--font-script`) as the per-glyph fallback. On a Hindi
// page, Latin letters and Western digits keep the brand faces while
// Devanagari glyphs fall through to Noto Sans Devanagari.
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-face",
  display: "swap",
  preload: true,
});

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body-face",
  display: "swap",
  preload: true,
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-utility-face",
  display: "swap",
  preload: true,
});

// Indic faces: preload is off and each one's class is applied only on its own
// locale's pages, so an English visitor never downloads either file, and a
// Hindi visitor never downloads the Bengali one.
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

export const LATIN_FONT_CLASSES = `${spaceGrotesk.variable} ${manrope.variable} ${ibmPlexSans.variable}`;

export function fontClassesFor(script: Script): string {
  if (script === "devanagari") return `${LATIN_FONT_CLASSES} ${notoDevanagari.variable}`;
  if (script === "bengali") return `${LATIN_FONT_CLASSES} ${notoBengali.variable}`;
  return LATIN_FONT_CLASSES;
}
