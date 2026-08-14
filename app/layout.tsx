import type { Metadata } from "next";
import { Space_Grotesk, Manrope, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import SiteChrome from "@/components/SiteChrome";
import ScrollProgress from "@/components/ScrollProgress";
import GlobalLoader from "@/components/GlobalLoader";
import JsonLd from "@/components/JsonLd";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

// Self-hosted via next/font — no external request to Google at runtime.
// Variables match the CSS custom property names in globals.css so that
// Tailwind utilities (font-display, font-body, font-utility) and the
// globals.css direct rules all resolve to the self-hosted stack.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
  preload: true,
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
  preload: true,
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-utility",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gridnova.in"),
  title: {
    default: "Grid Nova Energy | Engineering India's Clean Energy Future",
    template: "%s | Grid Nova Energy",
  },
  description:
    "Grid Nova Energy designs, engineers and delivers solar EPC, rooftop, utility-scale and O&M solutions across India — precision engineering for a decarbonised grid.",
  keywords: [
    "Grid Nova Energy",
    "Solar EPC India",
    "Green Energy Projects",
    "Utility Scale Solar",
    "PM Surya Ghar",
    "PM Kusum",
    "Renewable Energy West Bengal",
  ],
  openGraph: {
    title: "Grid Nova Energy | Engineering India's Clean Energy Future",
    description:
      "Solar EPC, rooftop, utility-scale and O&M solutions engineered for performance across India.",
    url: "https://www.gridnova.in",
    siteName: "Grid Nova Energy",
    locale: "en_IN",
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Grid Nova Energy",
    description: "Engineering India's clean energy future.",
    images: [OG_IMAGE.url],
  },
};

const POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Plot No. 83, Kasba Industrial Estate, Phase II",
  addressLocality: "Kolkata",
  addressRegion: "West Bengal",
  postalCode: "700107",
  addressCountry: "IN",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Grid Nova Energy",
  alternateName: "Grid Nova Energy — Eco-Energy Initiative",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/header-logo.png`,
  telephone: "+91-9874774440",
  email: "info@gridnova.in",
  address: POSTAL_ADDRESS,
  sameAs: [],
  makesOffer: [
    "Solar EPC Services",
    "Green Energy Projects",
    "Grid-Scale Solar Infrastructure",
    "Operation & Maintenance",
    "Energy Consulting",
  ],
};

// LocalBusiness schema — the real Kolkata office, for local/maps search.
const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#localbusiness`,
  name: "Grid Nova Energy",
  image: `${SITE_URL}${OG_IMAGE.url}`,
  url: SITE_URL,
  telephone: "+91-9874774440",
  email: "info@gridnova.in",
  priceRange: "$$",
  address: POSTAL_ADDRESS,
  geo: {
    "@type": "GeoCoordinates",
    latitude: 22.514723,
    longitude: 88.405869,
  },
  areaServed: ["West Bengal", "Bihar", "India"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable} ${ibmPlexSans.variable}`}
    >
      <head>
        <JsonLd data={organizationSchema} />
        <JsonLd data={localBusinessSchema} />
      </head>
      <body>
        <GlobalLoader />
        <ScrollProgress />
        <SmoothScroll>
          <SiteChrome>
            {children}
          </SiteChrome>
        </SmoothScroll>
      </body>
    </html>
  );
}
