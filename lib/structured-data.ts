import { OG_IMAGE, SITE_URL } from "@/lib/seo";

// Organization / LocalBusiness JSON-LD, shared by both root layouts. Names and
// addresses stay exactly as written (English) in every locale.

const POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Plot No. 83, Kasba Industrial Estate, Phase II",
  addressLocality: "Kolkata",
  addressRegion: "West Bengal",
  postalCode: "700107",
  addressCountry: "IN",
};

const PATNA_POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress:
    "C/O Parbati Bhawan, West Ram Krishna Nagar, New Bypass Road, Opposite Metro Pillar No. 81, P.O.- New Jaganpura",
  addressLocality: "Patna",
  addressRegion: "Bihar",
  postalCode: "800027",
  addressCountry: "IN",
};

export const organizationSchema = {
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
export const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#localbusiness-kolkata`,
  name: "Grid Nova Energy — Kolkata Office",
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

// LocalBusiness schema — the Patna office. No geo coordinates are set (none
// were provided for this location, unlike Kolkata's) rather than guessing.
export const patnaLocalBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#localbusiness-patna`,
  name: "Grid Nova Energy — Patna Office",
  image: `${SITE_URL}${OG_IMAGE.url}`,
  url: SITE_URL,
  telephone: "+91-9199576535",
  email: "info@gridnova.in",
  priceRange: "$$",
  address: PATNA_POSTAL_ADDRESS,
  areaServed: ["Bihar", "India"],
};
