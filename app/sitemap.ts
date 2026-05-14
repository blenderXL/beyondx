import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ["/", "/about", "/pricing", "/faq", "/login", "/signup"];
  return paths.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: "weekly" }));
}
