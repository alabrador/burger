import type { MetadataRoute } from "next";

const SITE = (process.env.APP_BASE_URL || "https://creatuburger.com").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const legal = ["/alergenos", "/condiciones", "/privacidad", "/cookies", "/aviso-legal"];
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    ...legal.map((p) => ({ url: `${SITE}${p}`, changeFrequency: "monthly" as const, priority: p === "/alergenos" ? 0.6 : 0.3 })),
  ];
}
