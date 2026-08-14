# Grid Nova Energy — Build Progress

## Status: 2 of 14 pages complete — Home, About

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · GSAP + ScrollTrigger ·
Framer Motion · React Three Fiber / Three.js · Lenis smooth scroll

## Run it
```
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (verified clean — 0 lint errors)
```

## What's built on Home
- Floating glass navigation, scroll-shrink, mobile drawer
- Cinematic R3F hero: floating faceted solar-panel geometry, animated "sun"
  emissive sphere, mouse-parallax rig, GSAP entrance sequence (staggered
  headline reveal, glass stats panel, CTAs)
- Services grid (5 offerings from the company profile) with scroll-reveal
- Vision / Mission / Core Values editorial split
- Target markets band (Residential / Commercial / Industrial / Government)
- Featured project — 1.3 MWp Showa India EPC reference + districts covered
- Sustainability & impact statement
- Leadership team teaser (5 leaders, linking to /leadership)
- Final CTA band + full footer with corporate info
- `robots.txt`, `sitemap.xml`, Organization JSON-LD, OG/Twitter meta
- Favicon generated from the uploaded logo mark (`app/icon.png`)

## Design tokens (locked in `app/globals.css` under `@theme`)
Primary #0E2A63 · Navy #091C3C · Solar Blue #2F5DAA · Emerald #3FAF55 ·
Lime #8FCF2E · Gold #F7A800 · Surface #F7F9FC · Steel #E4E8EE
Display: Space Grotesk · Body: Manrope · Utility/labels: IBM Plex Sans
Signature device: engineering-drawing reference tags (e.g. `SEC.01`,
`REF · SEC-EPC-01`) instead of generic numbered badges — nods to EPC
technical documentation.

## Known placeholders (clearly marked in code via `PlaceholderMedia`)
No real project photography exists yet. Every image slot renders a styled
placeholder documenting subject, camera angle, lighting and mood so a
photographer or stock search can fulfil it directly. Swap by dropping real
images into `/public` and replacing `<PlaceholderMedia />` with `<Image />`.

## What's built on About
- Editorial split hero (distinct from Home's 3D hero) — headline + placeholder
  team photo, GSAP staggered reveal
- Company overview with drop-cap paragraph + "at a glance" fact sidebar
- Competitive advantage as horizontal numbered rows (dark navy section)
- Core values as a scroll-driven vertical timeline with an animated
  progress line (GSAP ScrollTrigger `scrub`)
- Technology & capabilities checklist + placeholder equipment photo
- Leadership teaser + CTA (shared components, reused intentionally)
- Page-level SEO metadata + canonical URL

## Not yet built
Services, Industries, Projects, Technology, Leadership, Sustainability,
Careers, Contact, Privacy, Terms, 404 — 11 pages remaining, each with its
own unique layout per the master prompt. Say the word and I'll keep going.
