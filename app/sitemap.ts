import type { MetadataRoute } from "next";

const routes = [
  "",
  "about",
  "services",
  "industries",
  "projects",
  "technology",
  "leadership",
  "sustainability",
  "careers",
  "contact",
  "privacy",
  "terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.gridnova.in";
  return routes.map((route) => ({
    url: `${base}/${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
